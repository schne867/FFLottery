/**
 * Registry of user-adjustable settings.
 *
 * To add a setting, add one entry to SETTING_DEFINITIONS. The settings dialog and
 * localStorage persistence pick it up automatically.
 */

export const SETTINGS_STORAGE_KEY = 'ffLottery.settings';

export const SETTING_DEFINITIONS = [
  {
    key: 'mixTimeSeconds',
    label: 'Mix time',
    description: 'How long the drum tumbles before a ball comes out.',
    group: 'Lottery Animation',
    type: 'number',
    min: 0.5,
    max: 10,
    step: 0.25,
    unit: 's',
    default: 2,
  },
  {
    key: 'revealHoldSeconds',
    label: 'Reveal hold',
    description: 'How long each opened ball and team stay on screen.',
    group: 'Lottery Animation',
    type: 'number',
    min: 0.5,
    max: 10,
    step: 0.25,
    unit: 's',
    default: 2,
  },
  {
    key: 'pauseBetweenPicksSeconds',
    label: 'Pause between picks',
    description: 'A beat for the drum to settle before the next draw.',
    group: 'Lottery Animation',
    type: 'number',
    min: 0,
    max: 5,
    step: 0.25,
    unit: 's',
    default: 0.75,
  },
];

export function getDefaultSettings() {
  return Object.fromEntries(SETTING_DEFINITIONS.map(definition => [definition.key, definition.default]));
}

export function getSettingDefinition(key) {
  return SETTING_DEFINITIONS.find(definition => definition.key === key);
}

/**
 * Coerce a stored value into a valid one: clamp numbers into range, anything else becomes the default.
 */
export function normalizeSettingValue(definition, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return definition.default;
  }
  return Math.min(definition.max, Math.max(definition.min, value));
}

/**
 * Build a complete, valid settings object from untrusted input (e.g. parsed localStorage).
 * Unknown keys are dropped and missing keys get their defaults.
 */
export function normalizeSettings(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return Object.fromEntries(
    SETTING_DEFINITIONS.map(definition => [definition.key, normalizeSettingValue(definition, source[definition.key])])
  );
}

/**
 * Definitions grouped by their `group` heading, preserving registry order.
 */
export function groupSettingDefinitions() {
  const groups = [];
  for (const definition of SETTING_DEFINITIONS) {
    let entry = groups.find(g => g.group === definition.group);
    if (!entry) {
      entry = { group: definition.group, definitions: [] };
      groups.push(entry);
    }
    entry.definitions.push(definition);
  }
  return groups;
}
