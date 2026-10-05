import { useEffect, useState } from 'react';
import { PHASES, buildRevealSteps } from '../utils/revealTiming';

/**
 * Walks the reveal one step at a time on a timer.
 *
 * Timings are captured when the reveal starts; the settings menu sits behind the
 * lottery popup, so they can't change mid-reveal anyway.
 *
 * @param {number} resultCount - Number of picks (results ordered worst pick first, winner last)
 * @param {Object} timings - { mixTimeSeconds, revealHoldSeconds, pauseBetweenPicksSeconds }
 */
export function useRevealSequence(resultCount, timings) {
  const [steps] = useState(() => buildRevealSteps(resultCount, timings));
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (stepIndex >= steps.length) return undefined;
    const timer = setTimeout(() => setStepIndex(index => index + 1), steps[stepIndex].durationMs);
    return () => clearTimeout(timer);
  }, [stepIndex, steps]);

  const isComplete = stepIndex >= steps.length;
  const current = isComplete ? null : steps[stepIndex];
  const revealedCount = steps.slice(0, stepIndex).filter(step => step.phase === PHASES.REVEALING).length;

  return {
    pickIndex: current ? current.pickIndex : resultCount - 1,
    phase: current ? current.phase : PHASES.COMPLETE,
    revealedCount,
    isComplete,
  };
}
