import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsProvider, useSettings } from './SettingsContext';
import { SETTINGS_STORAGE_KEY, getDefaultSettings } from './settingsSchema';
import { createMemoryStorage } from '../test/memoryStorage';

function renderSettings(storage) {
  const wrapper = ({ children }) => <SettingsProvider storage={storage}>{children}</SettingsProvider>;
  return renderHook(() => useSettings(), { wrapper });
}

function readStored(storage) {
  return JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY));
}

describe('SettingsContext', () => {
  it('starts with defaults when nothing is saved', () => {
    const { result } = renderSettings(createMemoryStorage());
    expect(result.current.settings).toEqual(getDefaultSettings());
  });

  it('loads saved settings and normalizes them', () => {
    const storage = createMemoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({ mixTimeSeconds: 4, revealHoldSeconds: 99, oldKey: true }),
    });
    const { result } = renderSettings(storage);
    expect(result.current.settings).toEqual({
      mixTimeSeconds: 4,
      revealHoldSeconds: 10,
      pauseBetweenPicksSeconds: 0.75,
    });
  });

  it('uses defaults when the saved JSON is corrupt', () => {
    const storage = createMemoryStorage({ [SETTINGS_STORAGE_KEY]: '{not json' });
    const { result } = renderSettings(storage);
    expect(result.current.settings).toEqual(getDefaultSettings());
  });

  it('updates a setting, clamps it, and saves it', () => {
    const storage = createMemoryStorage();
    const { result } = renderSettings(storage);

    act(() => result.current.updateSetting('mixTimeSeconds', 5));
    expect(result.current.settings.mixTimeSeconds).toBe(5);
    expect(readStored(storage).mixTimeSeconds).toBe(5);

    act(() => result.current.updateSetting('mixTimeSeconds', 99));
    expect(result.current.settings.mixTimeSeconds).toBe(10);
  });

  it('ignores updates to unknown settings', () => {
    const { result } = renderSettings(createMemoryStorage());
    act(() => result.current.updateSetting('doesNotExist', 3));
    expect(result.current.settings).toEqual(getDefaultSettings());
  });

  it('resets to defaults and saves that', () => {
    const storage = createMemoryStorage();
    const { result } = renderSettings(storage);
    act(() => result.current.updateSetting('pauseBetweenPicksSeconds', 3));
    act(() => result.current.resetSettings());
    expect(result.current.settings).toEqual(getDefaultSettings());
    expect(readStored(storage)).toEqual(getDefaultSettings());
  });

  it('keeps working in memory when storage throws (e.g. private browsing)', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const { result } = renderSettings(storage);
    expect(result.current.settings).toEqual(getDefaultSettings());
    act(() => result.current.updateSetting('mixTimeSeconds', 6));
    expect(result.current.settings.mixTimeSeconds).toBe(6);
  });

  it('works with no storage at all', () => {
    const { result } = renderSettings(null);
    act(() => result.current.updateSetting('revealHoldSeconds', 3));
    expect(result.current.settings.revealHoldSeconds).toBe(3);
  });

  it('throws a clear error when used outside the provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useSettings())).toThrow('useSettings must be used inside a SettingsProvider');
    consoleError.mockRestore();
  });
});
