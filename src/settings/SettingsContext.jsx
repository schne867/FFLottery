import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  SETTINGS_STORAGE_KEY,
  getDefaultSettings,
  getSettingDefinition,
  normalizeSettings,
  normalizeSettingValue,
} from './settingsSchema';

const SettingsContext = createContext(null);

// Accessing window.localStorage itself can throw in some private-browsing modes
function getBrowserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSettings(storage) {
  try {
    const raw = storage?.getItem(SETTINGS_STORAGE_KEY);
    return normalizeSettings(raw ? JSON.parse(raw) : {});
  } catch {
    return getDefaultSettings();
  }
}

export function saveSettings(storage, settings) {
  try {
    storage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable or full - settings still work for this session
  }
}

/**
 * Provides user settings to the app and persists them to localStorage.
 * @param {Object} props
 * @param {Object|null} [props.storage] - Storage to use; defaults to window.localStorage. Pass null to disable persistence.
 */
export function SettingsProvider({ children, storage }) {
  const [store] = useState(() => (storage === undefined ? getBrowserStorage() : storage));
  const [settings, setSettings] = useState(() => loadSettings(store));

  useEffect(() => {
    saveSettings(store, settings);
  }, [store, settings]);

  const updateSetting = useCallback((key, value) => {
    const definition = getSettingDefinition(key);
    if (!definition) return;
    setSettings(prev => ({ ...prev, [key]: normalizeSettingValue(definition, value) }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(getDefaultSettings());
  }, []);

  const value = useMemo(
    () => ({ settings, updateSetting, resetSettings }),
    [settings, updateSetting, resetSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used inside a SettingsProvider');
  }
  return context;
}
