import { describe, expect, it } from 'vitest';
import {
  SETTINGS_STORAGE_KEY,
  SETTING_DEFINITIONS,
  getDefaultSettings,
  getSettingDefinition,
  groupSettingDefinitions,
  normalizeSettings,
  normalizeSettingValue,
} from './settingsSchema';

describe('settingsSchema', () => {
  it('uses a single namespaced storage key', () => {
    expect(SETTINGS_STORAGE_KEY).toBe('ffLottery.settings');
  });

  it('provides the three lottery animation timing defaults', () => {
    expect(getDefaultSettings()).toEqual({
      mixTimeSeconds: 2,
      revealHoldSeconds: 2,
      pauseBetweenPicksSeconds: 0.75,
    });
  });

  it('gives every definition a complete, consistent shape', () => {
    for (const definition of SETTING_DEFINITIONS) {
      expect(definition).toMatchObject({
        key: expect.any(String),
        label: expect.any(String),
        description: expect.any(String),
        group: expect.any(String),
        type: 'number',
        unit: expect.any(String),
      });
      expect(definition.min).toBeLessThanOrEqual(definition.default);
      expect(definition.default).toBeLessThanOrEqual(definition.max);
      expect(definition.step).toBeGreaterThan(0);
    }
  });

  it('has the agreed ranges', () => {
    expect(getSettingDefinition('mixTimeSeconds')).toMatchObject({ min: 0.5, max: 10, step: 0.25 });
    expect(getSettingDefinition('revealHoldSeconds')).toMatchObject({ min: 0.5, max: 10, step: 0.25 });
    expect(getSettingDefinition('pauseBetweenPicksSeconds')).toMatchObject({ min: 0, max: 5, step: 0.25 });
  });

  it('clamps out-of-range numbers', () => {
    const mix = getSettingDefinition('mixTimeSeconds');
    expect(normalizeSettingValue(mix, 99)).toBe(10);
    expect(normalizeSettingValue(mix, 0)).toBe(0.5);
    expect(normalizeSettingValue(mix, 3.5)).toBe(3.5);
  });

  it('falls back to the default for values that are not finite numbers', () => {
    const mix = getSettingDefinition('mixTimeSeconds');
    for (const bad of ['3', null, undefined, NaN, Infinity, {}, true]) {
      expect(normalizeSettingValue(mix, bad)).toBe(2);
    }
  });

  it('normalizes a saved object: keeps valid values, fills missing ones, drops unknown keys', () => {
    expect(normalizeSettings({ mixTimeSeconds: 4, revealHoldSeconds: 'slow', legacyThing: 1 })).toEqual({
      mixTimeSeconds: 4,
      revealHoldSeconds: 2,
      pauseBetweenPicksSeconds: 0.75,
    });
  });

  it('returns defaults for input that is not a plain object', () => {
    for (const bad of [null, undefined, 42, 'x', [1, 2]]) {
      expect(normalizeSettings(bad)).toEqual(getDefaultSettings());
    }
  });

  it('returns undefined for unknown setting keys', () => {
    expect(getSettingDefinition('nope')).toBeUndefined();
  });

  it('groups definitions in registry order', () => {
    expect(groupSettingDefinitions()).toEqual([
      { group: 'Lottery Animation', definitions: SETTING_DEFINITIONS },
    ]);
  });
});
