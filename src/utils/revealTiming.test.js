import { describe, expect, it } from 'vitest';
import { EJECT_SECONDS, GOLDEN_SECONDS, PHASES, buildRevealSteps, estimateRevealSeconds } from './revealTiming';

const timings = { mixTimeSeconds: 2, revealHoldSeconds: 3, pauseBetweenPicksSeconds: 0.5 };

describe('revealTiming', () => {
  it('uses the agreed fixed durations', () => {
    expect(EJECT_SECONDS).toBe(1);
    expect(GOLDEN_SECONDS).toBe(1.5);
  });

  it('draws every pick but the last with mixing, ejecting, revealing, pausing; the last gets the golden ball', () => {
    expect(buildRevealSteps(3, timings)).toEqual([
      { pickIndex: 0, phase: PHASES.MIXING, durationMs: 2000 },
      { pickIndex: 0, phase: PHASES.EJECTING, durationMs: 1000 },
      { pickIndex: 0, phase: PHASES.REVEALING, durationMs: 3000 },
      { pickIndex: 0, phase: PHASES.PAUSING, durationMs: 500 },
      { pickIndex: 1, phase: PHASES.MIXING, durationMs: 2000 },
      { pickIndex: 1, phase: PHASES.EJECTING, durationMs: 1000 },
      { pickIndex: 1, phase: PHASES.REVEALING, durationMs: 3000 },
      { pickIndex: 1, phase: PHASES.PAUSING, durationMs: 500 },
      { pickIndex: 2, phase: PHASES.GOLDEN, durationMs: 1500 },
      { pickIndex: 2, phase: PHASES.REVEALING, durationMs: 3000 },
    ]);
  });

  it('treats a one-team lottery as just the golden ball', () => {
    expect(buildRevealSteps(1, timings)).toEqual([
      { pickIndex: 0, phase: PHASES.GOLDEN, durationMs: 1500 },
      { pickIndex: 0, phase: PHASES.REVEALING, durationMs: 3000 },
    ]);
  });

  it('has no steps without teams', () => {
    expect(buildRevealSteps(0, timings)).toEqual([]);
  });

  it('estimates the default 6-team reveal at 32.25 seconds', () => {
    const defaults = { mixTimeSeconds: 2, revealHoldSeconds: 2, pauseBetweenPicksSeconds: 0.75 };
    expect(estimateRevealSeconds(6, defaults)).toBeCloseTo(32.25);
  });

  it('estimates zero seconds without teams', () => {
    expect(estimateRevealSeconds(0, timings)).toBe(0);
  });
});
