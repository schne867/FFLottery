/**
 * Lightweight 2D physics for the lottery ball machine.
 *
 * Coordinates are normalized: the drum is a circle of radius 1 centered at (0, 0) and
 * +y points down (screen coordinates). BallMachine multiplies by its pixel scale.
 * step() mutates the state in place so the render loop doesn't allocate every frame.
 */

// Where a drawn ball leaves the drum and where it comes to rest at the bottom of the chute
export const CHUTE = {
  mouth: { x: 1, y: 0 },
  end: { x: 1.9, y: 0.75 },
};

// Where the golden #1 ball floats to, just above the drum
export const RISE_TARGET = { x: 0, y: -1.25 };

// Tuning constants (units: drum radii and seconds)
const GRAVITY = 3;
const JET_LIFT = 4.6; // upward push on balls in the lower half while the jet runs
const SWIRL = 2.5; // sideways push around the drum while the jet runs
const JITTER = 40; // random kicks while the jet runs
const MAX_SPEED = 3.5;
const WALL_RESTITUTION = 0.75;
const BALL_RESTITUTION = 0.9;
const SETTLE_DAMPING = 1.5; // velocity decay per second with the jet off
const MAX_FRAME_DT = 0.05;
const SUBSTEP_DT = 1 / 240;
const MAX_BALL_RADIUS = 0.2;
const PACKING = 0.25; // fraction of the drum's area covered by balls
const PLACEMENT_ATTEMPTS = 500;
const EJECT_GLIDE_FRACTION = 0.4; // share of the eject spent gliding to the mouth

export function getBallRadius(count) {
  if (count <= 0) return MAX_BALL_RADIUS;
  return Math.min(MAX_BALL_RADIUS, Math.sqrt(PACKING / count));
}

/**
 * Deterministic random number generator (mulberry32) so tests can replay the same tumble.
 */
export function createSeededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create one ball per id, scattered inside the drum without overlapping.
 */
export function createDrumState(ids, { rng = Math.random } = {}) {
  const ballRadius = getBallRadius(ids.length);
  const maxDist = 1 - ballRadius;
  const balls = [];

  for (const id of ids) {
    let x = 0;
    let y = 0;
    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
      const angle = rng() * Math.PI * 2;
      const dist = Math.sqrt(rng()) * maxDist;
      x = Math.cos(angle) * dist;
      y = Math.sin(angle) * dist;
      if (balls.every(b => Math.hypot(b.x - x, b.y - y) >= 2 * ballRadius)) break;
    }
    balls.push({ id, x, y, vx: 0, vy: 0, status: 'inDrum', script: null });
  }

  return { ballRadius, balls };
}

export function startEject(state, id, durationSeconds) {
  startScript(state, id, 'eject', durationSeconds);
}

export function startRise(state, id, durationSeconds) {
  startScript(state, id, 'rise', durationSeconds);
}

/**
 * Advance the simulation. Large time jumps are clamped and split into small substeps
 * so fast balls can't tunnel through the drum wall.
 */
export function step(state, dt, { jetOn = false, rng = Math.random } = {}) {
  let remaining = Math.min(Math.max(dt, 0), MAX_FRAME_DT);
  while (remaining > 1e-9) {
    const h = Math.min(SUBSTEP_DT, remaining);
    substep(state, h, jetOn, rng);
    remaining -= h;
  }
  return state;
}

function startScript(state, id, kind, durationSeconds) {
  const ball = state.balls.find(b => b.id === id);
  if (!ball || ball.status !== 'inDrum') return;
  ball.status = 'scripted';
  ball.vx = 0;
  ball.vy = 0;
  ball.script = {
    kind,
    fromX: ball.x,
    fromY: ball.y,
    elapsed: 0,
    duration: Math.max(durationSeconds, 0.001),
  };
}

function substep(state, h, jetOn, rng) {
  const r = state.ballRadius;
  const free = [];

  for (const ball of state.balls) {
    if (ball.status === 'scripted') {
      advanceScript(ball, r, h);
      continue;
    }
    if (ball.status !== 'inDrum') continue;
    free.push(ball);

    let ax = 0;
    let ay = GRAVITY;
    if (jetOn) {
      if (ball.y > 0) ay -= JET_LIFT;
      const dist = Math.hypot(ball.x, ball.y) || 1;
      ax += SWIRL * (ball.y / dist);
      ay += SWIRL * (-ball.x / dist);
      ball.vx += (rng() - 0.5) * JITTER * h;
      ball.vy += (rng() - 0.5) * JITTER * h;
    }

    ball.vx += ax * h;
    ball.vy += ay * h;
    if (!jetOn) {
      const decay = Math.exp(-SETTLE_DAMPING * h);
      ball.vx *= decay;
      ball.vy *= decay;
    }
    clampSpeed(ball);
    ball.x += ball.vx * h;
    ball.y += ball.vy * h;
  }

  resolveBallCollisions(free, r, rng);
  for (const ball of free) constrainToDrum(ball, r);
}

function clampSpeed(ball) {
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > MAX_SPEED) {
    ball.vx *= MAX_SPEED / speed;
    ball.vy *= MAX_SPEED / speed;
  }
}

function resolveBallCollisions(balls, r, rng) {
  const minDist = 2 * r;
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i];
      const b = balls[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.hypot(dx, dy);
      if (dist >= minDist) continue;

      // Exactly stacked balls have no direction to separate along, so pick one at random
      if (dist < 1e-9) {
        const angle = rng() * Math.PI * 2;
        dx = Math.cos(angle);
        dy = Math.sin(angle);
        dist = 0;
      }
      const length = dist || 1;
      const nx = dx / length;
      const ny = dy / length;
      const overlap = minDist - dist;

      a.x -= (nx * overlap) / 2;
      a.y -= (ny * overlap) / 2;
      b.x += (nx * overlap) / 2;
      b.y += (ny * overlap) / 2;

      const approachSpeed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (approachSpeed < 0) {
        const impulse = (-(1 + BALL_RESTITUTION) * approachSpeed) / 2;
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;
      }
    }
  }
}

function constrainToDrum(ball, r) {
  const maxDist = 1 - r;
  const dist = Math.hypot(ball.x, ball.y);
  if (dist <= maxDist) return;
  const nx = ball.x / dist;
  const ny = ball.y / dist;
  ball.x = nx * maxDist;
  ball.y = ny * maxDist;
  const outwardSpeed = ball.vx * nx + ball.vy * ny;
  if (outwardSpeed > 0) {
    ball.vx -= (1 + WALL_RESTITUTION) * outwardSpeed * nx;
    ball.vy -= (1 + WALL_RESTITUTION) * outwardSpeed * ny;
  }
}

function advanceScript(ball, r, h) {
  const script = ball.script;
  script.elapsed = Math.min(script.elapsed + h, script.duration);
  const position = getScriptedPosition(script, r, script.elapsed / script.duration);
  ball.x = position.x;
  ball.y = position.y;
  if (script.elapsed >= script.duration) ball.status = 'done';
}

function getScriptedPosition(script, r, t) {
  if (script.kind === 'rise') {
    const e = easeInOut(t);
    return { x: lerp(script.fromX, RISE_TARGET.x, e), y: lerp(script.fromY, RISE_TARGET.y, e) };
  }

  // Eject: glide to the inside of the mouth, then roll down the chute, speeding up like it's downhill
  const mouthX = CHUTE.mouth.x - r;
  const mouthY = CHUTE.mouth.y;
  if (t < EJECT_GLIDE_FRACTION) {
    const e = easeInOut(t / EJECT_GLIDE_FRACTION);
    return { x: lerp(script.fromX, mouthX, e), y: lerp(script.fromY, mouthY, e) };
  }
  const e = easeIn((t - EJECT_GLIDE_FRACTION) / (1 - EJECT_GLIDE_FRACTION));
  return { x: lerp(mouthX, CHUTE.end.x, e), y: lerp(mouthY, CHUTE.end.y, e) };
}

function lerp(from, to, t) {
  return from + (to - from) * t;
}

function easeIn(t) {
  return t * t;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
