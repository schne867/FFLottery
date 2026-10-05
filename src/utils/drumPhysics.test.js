import { describe, expect, it } from 'vitest';
import {
  CHUTE,
  RISE_TARGET,
  createDrumState,
  createSeededRng,
  getBallRadius,
  startEject,
  startRise,
  step,
} from './drumPhysics';

const EPS = 1e-6;
const ids = n => Array.from({ length: n }, (_, i) => `team${i}`);
const distFromCenter = ball => Math.hypot(ball.x, ball.y);
const meanY = state => state.balls.reduce((sum, b) => sum + b.y, 0) / state.balls.length;

function runFrames(state, frames, options) {
  for (let i = 0; i < frames; i++) step(state, 1 / 60, options);
}

function expectAllInside(state) {
  for (const ball of state.balls.filter(b => b.status === 'inDrum')) {
    expect(distFromCenter(ball)).toBeLessThanOrEqual(1 - state.ballRadius + EPS);
  }
}

describe('getBallRadius', () => {
  it('caps the radius for small lotteries and shrinks it for big ones', () => {
    expect(getBallRadius(2)).toBe(0.2);
    expect(getBallRadius(6)).toBe(0.2);
    expect(getBallRadius(12)).toBeLessThan(0.2);
    expect(getBallRadius(20)).toBeLessThan(getBallRadius(12));
  });
});

describe('createSeededRng', () => {
  it('is deterministic and returns values in [0, 1)', () => {
    const a = createSeededRng(7);
    const b = createSeededRng(7);
    for (let i = 0; i < 100; i++) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('createDrumState', () => {
  it.each([2, 6, 12, 16, 20])('places %i balls inside the drum without overlapping', n => {
    const state = createDrumState(ids(n), { rng: createSeededRng(42) });
    const r = state.ballRadius;
    expect(state.balls).toHaveLength(n);
    expectAllInside(state);
    for (const ball of state.balls) expect(ball.status).toBe('inDrum');
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = state.balls[i];
        const b = state.balls[j];
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(2 * r - EPS);
      }
    }
  });
});

describe('step', () => {
  it('keeps every ball inside the drum while the jet runs for a long time', () => {
    const rng = createSeededRng(1);
    const state = createDrumState(ids(12), { rng });
    runFrames(state, 3000, { jetOn: true, rng });
    expectAllInside(state);
  });

  it('lifts and keeps tumbling the balls when the jet is on', () => {
    const jetState = createDrumState(ids(6), { rng: createSeededRng(3) });
    const calmState = createDrumState(ids(6), { rng: createSeededRng(3) });
    runFrames(jetState, 120, { jetOn: true, rng: createSeededRng(4) });
    runFrames(calmState, 120, { jetOn: false, rng: createSeededRng(4) });
    expect(meanY(jetState)).toBeLessThan(meanY(calmState) - 0.15);
    const meanSpeed = jetState.balls.reduce((sum, b) => sum + Math.hypot(b.vx, b.vy), 0) / jetState.balls.length;
    expect(meanSpeed).toBeGreaterThan(0.5);
  });

  it('lets balls settle toward the bottom when the jet turns off', () => {
    const rng = createSeededRng(5);
    const state = createDrumState(ids(6), { rng });
    runFrames(state, 120, { jetOn: true, rng });
    runFrames(state, 300, { jetOn: false, rng });
    expect(meanY(state)).toBeGreaterThan(0.4);
    expectAllInside(state);
  });

  it('pushes overlapping balls apart', () => {
    const state = createDrumState(['a', 'b'], { rng: createSeededRng(9) });
    const [a, b] = state.balls;
    Object.assign(a, { x: 0, y: 0.3, vx: 0, vy: 0 });
    Object.assign(b, { x: 0.01, y: 0.3, vx: 0, vy: 0 });
    step(state, 1 / 60, { jetOn: false, rng: createSeededRng(9) });
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(2 * state.ballRadius - EPS);
  });

  it('separates balls sitting exactly on top of each other', () => {
    const state = createDrumState(['a', 'b'], { rng: createSeededRng(9) });
    const [a, b] = state.balls;
    Object.assign(a, { x: 0, y: 0, vx: 0, vy: 0 });
    Object.assign(b, { x: 0, y: 0, vx: 0, vy: 0 });
    step(state, 1 / 60, { jetOn: false, rng: createSeededRng(9) });
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.1);
  });

  it('does not let a huge time jump (e.g. a background tab) push balls through the wall', () => {
    const rng = createSeededRng(11);
    const state = createDrumState(ids(6), { rng });
    Object.assign(state.balls[0], { x: 0.7, y: 0, vx: 50, vy: 0 });
    step(state, 5, { jetOn: true, rng });
    expectAllInside(state);
  });

  it('does nothing for zero, negative, or NaN time', () => {
    const state = createDrumState(ids(4), { rng: createSeededRng(2) });
    const before = JSON.stringify(state);
    step(state, 0);
    step(state, -1);
    step(state, NaN);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('startEject', () => {
  it('sends only the chosen ball out of the mouth and down the chute', () => {
    const rng = createSeededRng(21);
    const state = createDrumState(ids(6), { rng });
    const target = state.balls.find(b => b.id === 'team2');
    startEject(state, 'team2', 1);
    expect(target.status).toBe('scripted');

    for (let frame = 0; frame < 70; frame++) {
      step(state, 1 / 60, { jetOn: true, rng });
      // On its way out the ball is either still inside the drum or already past the mouth
      const inside = distFromCenter(target) <= 1 - state.ballRadius + EPS;
      expect(inside || target.x >= 1 - state.ballRadius - EPS).toBe(true);
    }

    expect(target.status).toBe('done');
    expect(target.x).toBeCloseTo(CHUTE.end.x, 5);
    expect(target.y).toBeCloseTo(CHUTE.end.y, 5);
    for (const ball of state.balls.filter(b => b.id !== 'team2')) expect(ball.status).toBe('inDrum');
    expectAllInside(state);
  });

  it('ignores unknown ids and balls that already left', () => {
    const state = createDrumState(ids(3), { rng: createSeededRng(4) });
    expect(() => startEject(state, 'nope', 1)).not.toThrow();
    startEject(state, 'team0', 1);
    runFrames(state, 70, { jetOn: false });
    startEject(state, 'team0', 1);
    expect(state.balls[0].status).toBe('done');
  });
});

describe('startRise', () => {
  it('floats the golden ball up to the rise point', () => {
    const state = createDrumState(ids(1), { rng: createSeededRng(8) });
    startRise(state, 'team0', 1.5);
    runFrames(state, 100, { jetOn: false });
    const ball = state.balls[0];
    expect(ball.status).toBe('done');
    expect(ball.x).toBeCloseTo(RISE_TARGET.x, 5);
    expect(ball.y).toBeCloseTo(RISE_TARGET.y, 5);
  });
});
