import { act } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * Advance fake timers in small slices, each inside act(), so React can re-render and
 * schedule the next timer between slices (state updates inside one act() are flushed
 * only when it ends).
 */
export function advanceTime(ms, slice = 10) {
  for (let elapsed = 0; elapsed < ms; elapsed += slice) {
    act(() => {
      vi.advanceTimersByTime(Math.min(slice, ms - elapsed));
    });
  }
}
