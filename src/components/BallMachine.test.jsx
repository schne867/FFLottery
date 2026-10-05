import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BallMachine } from './BallMachine';

const teams = [
  { userId: 'a', teamName: 'Alpha', avatar: null },
  { userId: 'b', teamName: 'Bravo', avatar: 'https://example.com/b.png' },
];

describe('BallMachine', () => {
  it('draws one ball per team', () => {
    render(<BallMachine teams={teams} jetOn={false} />);
    expect(screen.getAllByTestId(/^drum-ball-/)).toHaveLength(2);
  });

  it("shows the team's initial when a team has no avatar", () => {
    render(<BallMachine teams={teams} jetOn={false} />);
    expect(within(screen.getByTestId('drum-ball-a')).getByText('A')).toBeInTheDocument();
  });

  it('hides revealed balls no matter what the physics is doing', () => {
    // e.g. the tab was in the background, so the ball never finished rolling down the chute
    render(<BallMachine teams={teams} jetOn ejectId="a" hiddenIds={['a']} />);
    expect(screen.getByTestId('drum-ball-a')).toHaveAttribute('data-hidden', 'true');
    expect(screen.getByTestId('drum-ball-b')).not.toHaveAttribute('data-hidden');
  });

  it('marks the golden ball', () => {
    render(<BallMachine teams={teams} jetOn={false} riseId="b" />);
    expect(screen.getByTestId('drum-ball-b')).toHaveAttribute('data-golden', 'true');
    expect(screen.getByTestId('drum-ball-a')).not.toHaveAttribute('data-golden');
  });

  it('renders overlay content on top of the drum', () => {
    render(
      <BallMachine teams={teams} jetOn={false}>
        <span>Opened ball</span>
      </BallMachine>
    );
    expect(within(screen.getByTestId('ball-machine')).getByText('Opened ball')).toBeInTheDocument();
  });

  it('stops its animation loop when unmounted', () => {
    const cancel = vi.spyOn(window, 'cancelAnimationFrame');
    const { unmount } = render(<BallMachine teams={teams} jetOn />);
    unmount();
    expect(cancel).toHaveBeenCalled();
    cancel.mockRestore();
  });
});
