import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import confetti from 'canvas-confetti';
import { SelectionAnimation } from './SelectionAnimation';
import { SettingsProvider } from '../settings/SettingsContext';
import { SETTINGS_STORAGE_KEY } from '../settings/settingsSchema';
import { createMemoryStorage } from '../test/memoryStorage';
import { advanceTime } from '../test/advanceTime';

vi.mock('canvas-confetti', () => {
  const confettiMock = vi.fn();
  confettiMock.reset = vi.fn();
  return { default: confettiMock };
});

// runNBALottery order: worst pick first, winner last
const results = [
  { userId: 'c', teamName: 'Charlie', avatar: null, pickNumber: 3, position: 1 },
  { userId: 'b', teamName: 'Bravo', avatar: null, pickNumber: 2, position: 2 },
  { userId: 'a', teamName: 'Alpha', avatar: null, pickNumber: 1, position: 3 },
];

// Per regular pick: 1000 mix + 1000 eject + 1000 reveal + 500 pause = 3500ms
// Winner: 1500 golden + 1000 reveal. Whole reveal: 9500ms
const FAST_TIMINGS = { mixTimeSeconds: 1, revealHoldSeconds: 1, pauseBetweenPicksSeconds: 0.5 };

function renderAnimation(props = {}) {
  const storage = createMemoryStorage({ [SETTINGS_STORAGE_KEY]: JSON.stringify(FAST_TIMINGS) });
  const handlers = { onStart: vi.fn(), onComplete: vi.fn(), onSkip: vi.fn() };
  const ui = extra => (
    <SettingsProvider storage={storage}>
      <SelectionAnimation results={results} animationStarted leagueName="Test League" {...handlers} {...props} {...extra} />
    </SettingsProvider>
  );
  const view = render(ui());
  return { ...view, ...handlers, rerenderWith: extra => view.rerender(ui(extra)) };
}

const headline = () => screen.getByTestId('reveal-headline');

describe('SelectionAnimation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    confetti.mockClear();
    confetti.reset.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('shows the start screen until the lottery starts', () => {
    const { onStart } = renderAnimation({ animationStarted: false });
    expect(screen.getByText('The Test League Draft Lottery')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /start lottery/i }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('draws the worst pick first, with a ball in the drum for every team', () => {
    renderAnimation();
    expect(headline()).toHaveTextContent('Drawing Pick #3…');
    expect(screen.getAllByTestId(/^drum-ball-/)).toHaveLength(3);
  });

  it('opens the drawn ball to reveal the team after mixing and ejecting', () => {
    renderAnimation();
    advanceTime(2000);
    expect(headline()).toHaveTextContent('Pick #3');
    expect(within(screen.getByTestId('revealed-ball')).getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByTestId('drum-ball-c')).toHaveAttribute('data-hidden', 'true');
  });

  it('puts each revealed pick on the draft board', () => {
    renderAnimation();
    advanceTime(3000);
    expect(headline()).toHaveTextContent('Up next: Pick #2');
    expect(within(screen.getByTestId('draft-board')).getByText('Charlie')).toBeInTheDocument();
  });

  it('builds tension when two teams are left', () => {
    renderAnimation();
    advanceTime(3500);
    expect(headline()).toHaveTextContent('Two teams left…');
  });

  it('finishes with the golden #1 ball, confetti, and View Results', () => {
    const { onComplete } = renderAnimation();
    advanceTime(7000);
    expect(headline()).toHaveTextContent('And the #1 pick goes to…');
    expect(screen.getByTestId('drum-ball-a')).toHaveAttribute('data-golden', 'true');

    advanceTime(1500);
    expect(headline()).toHaveTextContent('🏆 Pick #1');
    expect(within(screen.getByTestId('revealed-ball')).getByText('Alpha')).toBeInTheDocument();
    advanceTime(250);
    expect(confetti).toHaveBeenCalled();

    advanceTime(750);
    expect(headline()).toHaveTextContent('🏆 The draft order is set!');
    expect(screen.getByRole('button', { name: /view results/i })).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);

    advanceTime(5000);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('lets you skip at any time', () => {
    const { onSkip } = renderAnimation();
    advanceTime(1200);
    fireEvent.click(screen.getByRole('button', { name: /skip to results/i }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('stops everything when closed mid-reveal', () => {
    const { onComplete, unmount } = renderAnimation();
    advanceTime(1000);
    unmount();
    advanceTime(20000);
    expect(onComplete).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops confetti and timers when closed during the winner reveal', () => {
    const { unmount } = renderAnimation();
    advanceTime(8750);
    expect(confetti).toHaveBeenCalled();
    unmount();
    expect(confetti.reset).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    const callsAtClose = confetti.mock.calls.length;
    advanceTime(5000);
    expect(confetti.mock.calls.length).toBe(callsAtClose);
  });

  it('restarts from the worst pick when the lottery is run again', () => {
    const { rerenderWith } = renderAnimation();
    advanceTime(4000);
    rerenderWith({ animationStarted: false });
    rerenderWith({ animationStarted: true });
    expect(headline()).toHaveTextContent('Drawing Pick #3…');
    expect(screen.queryByTestId('draft-board')).toBeInTheDocument();
    expect(within(screen.getByTestId('draft-board')).queryByText('Charlie')).not.toBeInTheDocument();
  });
});
