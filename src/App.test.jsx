import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { SettingsProvider } from './settings/SettingsContext';
import { runNBALottery } from './utils/nbaLottery';

vi.mock('./services/sleeperApi', async importOriginal => ({
  ...(await importOriginal()),
  getLeague: vi.fn(async () => ({ league_id: '1', name: 'Test League', settings: { playoff_teams: 6 } })),
  getLeagueTeams: vi.fn(async () =>
    Array.from({ length: 12 }, (_, i) => ({
      userId: `u${i}`,
      teamName: `Team ${i}`,
      avatar: null,
      wins: 12 - i,
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
