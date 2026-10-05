import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsDialog } from './SettingsDialog';
import { SettingsProvider } from '../settings/SettingsContext';
import { SETTINGS_STORAGE_KEY } from '../settings/settingsSchema';
import { createMemoryStorage } from '../test/memoryStorage';

function renderDialog(props = {}) {
  const storage = createMemoryStorage();
  render(
    <SettingsProvider storage={storage}>
      <SettingsDialog {...props} />
    </SettingsProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  return { storage };
}

describe('SettingsDialog', () => {
  it('opens from the gear button and shows the Lottery Animation group', () => {
    renderDialog();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Lottery Animation')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Mix time' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Reveal hold' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Pause between picks' })).toBeInTheDocument();
  });

  it('shows current values', () => {
    renderDialog();
    expect(screen.getByTestId('setting-mixTimeSeconds-value')).toHaveTextContent('2s');
    expect(screen.getByTestId('setting-pauseBetweenPicksSeconds-value')).toHaveTextContent('0.75s');
  });

  it('applies and saves a slider change immediately', () => {
    const { storage } = renderDialog();
    fireEvent.change(screen.getByRole('slider', { name: 'Mix time' }), { target: { value: 5 } });
    expect(screen.getByTestId('setting-mixTimeSeconds-value')).toHaveTextContent('5s');
    expect(JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY)).mixTimeSeconds).toBe(5);
  });

  it('resets to defaults', () => {
    renderDialog();
    fireEvent.change(screen.getByRole('slider', { name: 'Mix time' }), { target: { value: 5 } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    expect(screen.getByTestId('setting-mixTimeSeconds-value')).toHaveTextContent('2s');
  });

  it('estimates the reveal length for the loaded lottery and updates it live', () => {
    renderDialog({ lotteryTeamCount: 6 });
    expect(screen.getByTestId('reveal-estimate')).toHaveTextContent('≈ 32s for 6 teams');
    fireEvent.change(screen.getByRole('slider', { name: 'Mix time' }), { target: { value: 5 } });
    expect(screen.getByTestId('reveal-estimate')).toHaveTextContent('≈ 47s for 6 teams');
  });

  it('asks for a league when no lottery teams are loaded', () => {
    renderDialog({ lotteryTeamCount: 0 });
    expect(screen.getByTestId('reveal-estimate')).toHaveTextContent('Load a league to see how long the reveal will take.');
  });
});
