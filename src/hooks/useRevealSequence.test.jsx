import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRevealSequence } from './useRevealSequence';
import { advanceTime } from '../test/advanceTime';

// Per regular pick: 2000 mix + 1000 eject + 3000 reveal + 500 pause = 6500ms
const timings = { mixTimeSeconds: 2, revealHoldSeconds: 3, pauseBetweenPicksSeconds: 0.5 };

describe('useRevealSequence', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts by mixing for the first (worst) pick', () => {
    const { result } = renderHook(() => useRevealSequence(3, timings));
    expect(result.current).toEqual({ pickIndex: 0, phase: 'mixing', revealedCount: 0, isComplete: false });
  });

  it('moves through the phases on the configured clock', () => {
    const { result } = renderHook(() => useRevealSequence(3, timings));
    advanceTime(1999);
    expect(result.current.phase).toBe('mixing');
    advanceTime(1);
    expect(result.current.phase).toBe('ejecting');
    advanceTime(1000);
    expect(result.current.phase).toBe('revealing');
    expect(result.current.revealedCount).toBe(0);
    advanceTime(3000);
    expect(result.current.phase).toBe('pausing');
    expect(result.current.revealedCount).toBe(1);
    advanceTime(500);
    expect(result.current).toMatchObject({ pickIndex: 1, phase: 'mixing' });
  });

  it('gives the last pick the golden ball instead of a draw, then completes', () => {
    const { result } = renderHook(() => useRevealSequence(3, timings));
    advanceTime(2 * 6500);
    expect(result.current).toMatchObject({ pickIndex: 2, phase: 'golden' });
    advanceTime(1500);
    expect(result.current).toMatchObject({ pickIndex: 2, phase: 'revealing', revealedCount: 2 });
    advanceTime(3000);
    expect(result.current).toEqual({ pickIndex: 2, phase: 'complete', revealedCount: 3, isComplete: true });
  });

  it('keeps the timings it started with', () => {
    const { result, rerender } = renderHook(({ t }) => useRevealSequence(3, t), { initialProps: { t: timings } });
    rerender({ t: { ...timings, mixTimeSeconds: 10 } });
    advanceTime(2000);
    expect(result.current.phase).toBe('ejecting');
  });

  it('stops all timers when unmounted', () => {
    const { unmount } = renderHook(() => useRevealSequence(3, timings));
    advanceTime(2500);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
