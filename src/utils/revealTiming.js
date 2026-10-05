/**
 * Timing model for the ball machine reveal.
 *
 * Every pick except #1 runs mixing -> ejecting -> revealing -> pausing.
 * The #1 pick is the last ball left, so it skips the draw: golden -> revealing.
 */

export const PHASES = {
  MIXING: 'mixing',
  EJECTING: 'ejecting',
  REVEALING: 'revealing',
  PAUSING: 'pausing',
  GOLDEN: 'golden',
  COMPLETE: 'complete',
};

// Fixed physics/animation durations (not user settings)
export const EJECT_SECONDS = 1;
export const GOLDEN_SECONDS = 1.5;

/**
 * @param {number} resultCount - Number of picks to reveal (results ordered worst pick first, winner last)
 * @param {Object} timings - { mixTimeSeconds, revealHoldSeconds, pauseBetweenPicksSeconds }
 * @returns {Array<{pickIndex: number, phase: string, durationMs: number}>}
 */
export function buildRevealSteps(resultCount, timings) {
  const mixMs = timings.mixTimeSeconds * 1000;
  const revealMs = timings.revealHoldSeconds * 1000;
  const pauseMs = timings.pauseBetweenPicksSeconds * 1000;
  const steps = [];

  for (let pickIndex = 0; pickIndex < resultCount; pickIndex++) {
    const isWinner = pickIndex === resultCount - 1;
    if (isWinner) {
      steps.push({ pickIndex, phase: PHASES.GOLDEN, durationMs: GOLDEN_SECONDS * 1000 });
      steps.push({ pickIndex, phase: PHASES.REVEALING, durationMs: revealMs });
    } else {
      steps.push({ pickIndex, phase: PHASES.MIXING, durationMs: mixMs });
      steps.push({ pickIndex, phase: PHASES.EJECTING, durationMs: EJECT_SECONDS * 1000 });
      steps.push({ pickIndex, phase: PHASES.REVEALING, durationMs: revealMs });
      steps.push({ pickIndex, phase: PHASES.PAUSING, durationMs: pauseMs });
    }
  }

  return steps;
}

/**
 * Total reveal length in seconds for a lottery of `teamCount` teams.
 */
export function estimateRevealSeconds(teamCount, timings) {
  const totalMs = buildRevealSteps(teamCount, timings).reduce((sum, step) => sum + step.durationMs, 0);
  return totalMs / 1000;
}
