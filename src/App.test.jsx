import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { SettingsProvider } from './settings/SettingsContext';
import { runNBALottery } from './utils/nbaLottery';

const mockLeague = vi.hoisted(() => ({ teamCount: 12 }));

vi.mock('./services/sleeperApi', async importOriginal => ({
  ...(await importOriginal()),
  getLeague: vi.fn(async () => ({ league_id: '1', name: 'Test League', settings: { playoff_teams: 6 } })),
  getLeagueTeams: vi.fn(async () =>
    Array.from({ length: mockLeague.teamCount }, (_, i) => ({
      userId: `u${i}`,
      teamName: `Team ${i}`,
      avatar: null,
      wins: mockLeague.teamCount - i,
      losses: i,
      ties: 0,
      pointsFor: 1500 - i * 10,
      pointsAgainst: null,
      totalPoints: 1500 - i * 10,
    }))
  ),
  getLeagueDrafts: vi.fn(async () => []),
}));

vi.mock('./utils/nbaLottery', async importOriginal => ({
  ...(await importOriginal()),
  runNBALottery: vi.fn(),
}));

describe('App lottery popup', () => {
  beforeEach(() => {
    sessionStorage.clear();
    runNBALottery.mockReset();
    mockLeague.teamCount = 12;
  });

  it('closes the popup and shows the error when the lottery fails to run', async () => {
    runNBALottery.mockRejectedValue(new Error('Total combinations cannot be zero'));
    render(
      <SettingsProvider storage={null}>
        <App />
      </SettingsProvider>
    );

    fireEvent.change(screen.getByLabelText('Sleeper League ID'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /load teams/i }));
    fireEvent.click(await screen.findByRole('button', { name: /run lottery/i }));
    fireEvent.click(await screen.findByRole('button', { name: /start lottery/i }));

    await waitFor(() => expect(screen.queryByRole('button', { name: /start lottery/i })).not.toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('Total combinations cannot be zero');
  });
});

async function loadLeague() {
  render(
    <SettingsProvider storage={null}>
      <App />
    </SettingsProvider>
  );
  fireEvent.change(screen.getByLabelText('Sleeper League ID'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: /load teams/i }));
  await screen.findByRole('button', { name: /run lottery/i });
}

function chooseOdds(optionName) {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /combination distribution/i }));
  fireEvent.click(screen.getByRole('option', { name: optionName }));
}

describe('App odds options', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockLeague.teamCount = 12;
  });

  it('gives the 6 non-playoff teams 4-2-1 tiered odds with round numbers', async () => {
    await loadLeague();
    chooseOdds('Tiered 4-2-1 (each third half the odds)');
    expect(screen.getAllByText('28.6% chance')).toHaveLength(2);
    expect(screen.getAllByText('14.3% chance')).toHaveLength(2);
    expect(screen.getAllByText('7.1% chance')).toHaveLength(2);
    expect(screen.getByText('Total: 1400')).toBeInTheDocument();
  });

  it('caps a whole-league lottery at 12 teams and lists the rest as non-lottery', async () => {
    mockLeague.teamCount = 14;
    await loadLeague();
    chooseOdds('Equal');
    expect(screen.getAllByText('8.3% chance')).toHaveLength(12);
    expect(screen.getByText('Non-Lottery:')).toBeInTheDocument();
  });
});
