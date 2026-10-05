# Ball Machine Lottery Reveal & Settings Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the lottery reveal popup with an NBA-style ping-pong ball machine (one avatar ball per team, golden #1 finale) whose timings are adjustable from a new, extensible settings menu.

**Architecture:** `App.jsx` keeps computing the full lottery result up front and hands it to `SelectionAnimation`, which now owns the reveal: a clock-driven `useRevealSequence` hook steps each pick through mixing → ejecting → revealing → pausing, and `BallMachine` renders a DOM/SVG drum animated by a pure `drumPhysics` module. Settings live in a registry (`settingsSchema.js`), a `SettingsContext` persists them to `localStorage`, and a gear-button `SettingsDialog` renders sliders from the registry.

**Tech Stack:** React 18, Vite 5, MUI 5, canvas-confetti (existing); Vitest 2 + React Testing Library + jsdom (new, dev only); Playwright via a scratchpad script for visual checks (not committed).

**Spec:** `docs/superpowers/specs/2026-10-05-ball-machine-lottery-design.md`

## Global Constraints

- No new runtime dependencies. Dev dependencies added: `vitest`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `jsdom`.
- The lottery math does not change: `runNBALottery()` still computes all results before the reveal starts; the animation never influences outcomes.
- Reveal order: worst pick first, ending at #1.
- Settings (group **Lottery Animation**): `mixTimeSeconds` 0.5–10 s step 0.25 default 2; `revealHoldSeconds` 0.5–10 s step 0.25 default 2; `pauseBetweenPicksSeconds` 0–5 s step 0.25 default 0.75.
- Fixed (non-setting) durations: eject ≈ 1 s (`EJECT_SECONDS = 1`), golden rise ≈ 1.5 s (`GOLDEN_SECONDS = 1.5`).
- Settings persist in `localStorage` under the single key `ffLottery.settings`; out-of-range → clamped, missing/invalid → default, unknown keys → dropped, corrupt JSON or throwing storage → defaults without crashing.
- Settings apply and persist immediately (no Save button); "Reset to defaults" button.
- Skip works at any time; after the reveal completes the button reads "View Results".
- The pre-start screen (league title + "Start Lottery" over the background image) keeps its current look.
- Tests run with `npm test`. Test files live next to the code they test (`*.test.js` / `*.test.jsx`).

## Review Focus

1. **Tab hidden mid-reveal** — `requestAnimationFrame` pauses while timers keep running, so the drawn ball may still be mid-chute when its reveal begins; expected: the drum hides that ball the moment its reveal starts. Pinned by Task 7, "hides revealed balls no matter what the physics is doing".
2. **Large leagues (16–20 lottery teams)** — expected: all balls fit in the drum without overlapping at the start and never escape. Pinned by Task 5, `createDrumState` `it.each([2, 6, 12, 16, 20])`.
3. **Skip/close during the winner's confetti** — expected: confetti stops immediately and no timers or callbacks fire afterwards. Pinned by Task 8, "stops confetti and timers when closed during the winner reveal".
4. **Running the lottery a second time in one session** — expected: the reveal restarts at the worst pick with a full drum. Pinned by Task 8, "restarts from the worst pick when the lottery is run again".
5. **Hand-edited or older saved settings** (strings, out-of-range numbers, unknown keys, corrupt JSON) — expected: the app loads with sane values. Pinned by Task 1 (normalization tests) and Task 2 (corrupt JSON / throwing storage tests).

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `package.json` | Modify | Add dev deps and `test` scripts |
| `vite.config.js` | Modify | Vitest config (jsdom, globals, setup file) |
| `src/test/setup.js` | Create | Registers jest-dom matchers |
| `src/test/memoryStorage.js` | Create | In-memory `localStorage` stand-in for tests |
| `src/test/advanceTime.js` | Create | Advances fake timers in slices so React can schedule follow-up timers |
| `src/settings/settingsSchema.js` | Create | Setting definitions registry + normalization helpers |
| `src/settings/SettingsContext.jsx` | Create | `SettingsProvider`, `useSettings`, load/save |
| `src/main.jsx` | Modify | Wrap `<App />` in `SettingsProvider` |
| `src/utils/revealTiming.js` | Create | Phase names, fixed durations, `buildRevealSteps`, `estimateRevealSeconds` |
| `src/components/SettingsDialog.jsx` | Create | Gear button + settings dialog rendered from the registry |
| `src/utils/drumPhysics.js` | Create | Pure normalized-coordinate drum physics |
| `src/hooks/useRevealSequence.js` | Create | Clock that walks the reveal steps |
| `src/components/BallMachine.jsx` | Create | Drum/chute SVG + avatar balls driven by `drumPhysics` |
| `src/components/SelectionAnimation.jsx` | Rewrite | Start screen + reveal stage composition, confetti, draft board |
| `src/App.jsx` | Modify | Gear button; hand results to the animation; remove old timing/confetti code |
| `CLAUDE.md` | Modify | Document new modules and `npm test` |

---

### Task 1: Test tooling and the settings registry

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`
- Create: `src/test/setup.js`
- Create: `src/settings/settingsSchema.js`
- Test: `src/settings/settingsSchema.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (from `src/settings/settingsSchema.js`):
  - `SETTINGS_STORAGE_KEY: 'ffLottery.settings'`
  - `SETTING_DEFINITIONS: Array<{ key, label, description, group, type: 'number', min, max, step, unit, default }>`
  - `getDefaultSettings(): { [key]: number }`
  - `getSettingDefinition(key: string): definition | undefined`
  - `normalizeSettingValue(definition, value: unknown): number`
  - `normalizeSettings(raw: unknown): { [key]: number }`
  - `groupSettingDefinitions(): Array<{ group: string, definitions: definition[] }>`

- [ ] **Step 1: Commit the pending esbuild approval on its own**

`package.json` already has an uncommitted `allowScripts` entry (added when esbuild's install script was approved). Commit it separately so it doesn't get mixed into feature commits:

```bash
git add package.json
git commit -m "Allow esbuild install script"
```

- [ ] **Step 2: Install test dev dependencies**

Run:
```bash
npm install -D vitest@^2.1.9 @testing-library/react@^16.3.0 @testing-library/dom@^10.4.0 @testing-library/jest-dom@^6.6.3 jsdom@^25.0.1
```
Expected: install succeeds; `package.json` `devDependencies` now lists the five packages.

- [ ] **Step 3: Add test scripts to `package.json`**

In the `"scripts"` block, add two entries so it reads:

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 4: Configure Vitest in `vite.config.js`**

Replace the whole file with:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
})
```

(`globals: true` lets React Testing Library clean up the DOM after each test automatically.)

- [ ] **Step 5: Create `src/test/setup.js`**

```js
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 6: Write the failing registry tests**

Create `src/settings/settingsSchema.test.js`:

```js
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
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `npx vitest run src/settings/settingsSchema.test.js`
Expected: FAIL — cannot resolve `./settingsSchema`.

- [ ] **Step 8: Implement `src/settings/settingsSchema.js`**

```js
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
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — 10 tests in `settingsSchema.test.js`.

- [ ] **Step 10: Commit**

```bash
git add package.json vite.config.js src/test/setup.js src/settings/settingsSchema.js src/settings/settingsSchema.test.js
git commit -m "Add Vitest setup and settings registry"
```

---

### Task 2: Settings context with localStorage persistence

**Files:**
- Create: `src/test/memoryStorage.js`
- Create: `src/settings/SettingsContext.jsx`
- Modify: `src/main.jsx`
- Test: `src/settings/SettingsContext.test.jsx`

**Interfaces:**
- Consumes: `SETTINGS_STORAGE_KEY`, `getDefaultSettings`, `getSettingDefinition`, `normalizeSettings`, `normalizeSettingValue` from Task 1.
- Produces:
  - `SettingsProvider({ children, storage? })`: `storage` is optional; it defaults to `window.localStorage` (or `null` when that throws). Pass `null` for no persistence, or a `{ getItem, setItem }` object in tests.
  - `useSettings(): { settings: { mixTimeSeconds, revealHoldSeconds, pauseBetweenPicksSeconds }, updateSetting(key, value), resetSettings() }`. Throws if used outside the provider.
  - `loadSettings(storage): settings` and `saveSettings(storage, settings): void`. Neither ever throws.
  - Test helper `createMemoryStorage(initial?: { [key]: string })` from `src/test/memoryStorage.js`.

- [ ] **Step 1: Create the test helper `src/test/memoryStorage.js`**

```js
/**
 * Minimal in-memory stand-in for window.localStorage, for tests.
 */
export function createMemoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      data.set(key, String(value));
    },
    removeItem: key => {
      data.delete(key);
    },
  };
}
```

- [ ] **Step 2: Write the failing context tests**

Create `src/settings/SettingsContext.test.jsx`:

```jsx
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/settings/SettingsContext.test.jsx`
Expected: FAIL — cannot resolve `./SettingsContext`.

- [ ] **Step 4: Implement `src/settings/SettingsContext.jsx`**

```jsx
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS — all `settingsSchema` and `SettingsContext` tests.

- [ ] **Step 6: Wrap the app in the provider (`src/main.jsx`)**

Add the import after `import App from './App';`:

```jsx
import { SettingsProvider } from './settings/SettingsContext';
```

And change the render call to:

```jsx
  root.render(
    <React.StrictMode>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </React.StrictMode>
  );
```

- [ ] **Step 7: Verify the build still works**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 8: Commit**

```bash
git add src/test/memoryStorage.js src/settings/SettingsContext.jsx src/settings/SettingsContext.test.jsx src/main.jsx
git commit -m "Add settings context with localStorage persistence"
```

---

### Task 3: Reveal timing model

**Files:**
- Create: `src/utils/revealTiming.js`
- Test: `src/utils/revealTiming.test.js`

**Interfaces:**
- Consumes: the timing settings shape `{ mixTimeSeconds, revealHoldSeconds, pauseBetweenPicksSeconds }` (Task 1).
- Produces (from `src/utils/revealTiming.js`):
  - `PHASES = { MIXING: 'mixing', EJECTING: 'ejecting', REVEALING: 'revealing', PAUSING: 'pausing', GOLDEN: 'golden', COMPLETE: 'complete' }`
  - `EJECT_SECONDS = 1`, `GOLDEN_SECONDS = 1.5`
  - `buildRevealSteps(resultCount: number, timings): Array<{ pickIndex: number, phase: string, durationMs: number }>`. `pickIndex` indexes the results array, which is ordered worst pick first and winner last.
  - `estimateRevealSeconds(teamCount: number, timings): number`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/revealTiming.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { EJECT_SECONDS, GOLDEN_SECONDS, PHASES, buildRevealSteps, estimateRevealSeconds } from './revealTiming';

const timings = { mixTimeSeconds: 2, revealHoldSeconds: 3, pauseBetweenPicksSeconds: 0.5 };

describe('revealTiming', () => {
  it('uses the agreed fixed durations', () => {
    expect(EJECT_SECONDS).toBe(1);
    expect(GOLDEN_SECONDS).toBe(1.5);
  });

  it('draws every pick but the last with mixing, ejecting, revealing, pausing; the last gets the golden ball', () => {
    expect(buildRevealSteps(3, timings)).toEqual([
      { pickIndex: 0, phase: PHASES.MIXING, durationMs: 2000 },
      { pickIndex: 0, phase: PHASES.EJECTING, durationMs: 1000 },
      { pickIndex: 0, phase: PHASES.REVEALING, durationMs: 3000 },
      { pickIndex: 0, phase: PHASES.PAUSING, durationMs: 500 },
      { pickIndex: 1, phase: PHASES.MIXING, durationMs: 2000 },
      { pickIndex: 1, phase: PHASES.EJECTING, durationMs: 1000 },
      { pickIndex: 1, phase: PHASES.REVEALING, durationMs: 3000 },
      { pickIndex: 1, phase: PHASES.PAUSING, durationMs: 500 },
      { pickIndex: 2, phase: PHASES.GOLDEN, durationMs: 1500 },
      { pickIndex: 2, phase: PHASES.REVEALING, durationMs: 3000 },
    ]);
  });

  it('treats a one-team lottery as just the golden ball', () => {
    expect(buildRevealSteps(1, timings)).toEqual([
      { pickIndex: 0, phase: PHASES.GOLDEN, durationMs: 1500 },
      { pickIndex: 0, phase: PHASES.REVEALING, durationMs: 3000 },
    ]);
  });

  it('has no steps without teams', () => {
    expect(buildRevealSteps(0, timings)).toEqual([]);
  });

  it('estimates the default 6-team reveal at 32.25 seconds', () => {
    const defaults = { mixTimeSeconds: 2, revealHoldSeconds: 2, pauseBetweenPicksSeconds: 0.75 };
    expect(estimateRevealSeconds(6, defaults)).toBeCloseTo(32.25);
  });

  it('estimates zero seconds without teams', () => {
    expect(estimateRevealSeconds(0, timings)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/revealTiming.test.js`
Expected: FAIL — cannot resolve `./revealTiming`.

- [ ] **Step 3: Implement `src/utils/revealTiming.js`**

```js
/**
 * Timing model for the ball machine reveal.
 *
 * Every pick except #1 runs mixing -> ejecting -> revealing -> pausing.
 * The #1 pick is the last ball left, so it skips the draw: golden -> revealing.
 */

export const PHASES = {
  MIXING: 'mixing',
  EJECTING: 'ejecting',
  REVEALING: 'revealing',
  PAUSING: 'pausing',
  GOLDEN: 'golden',
  COMPLETE: 'complete',
};

// Fixed physics/animation durations (not user settings)
export const EJECT_SECONDS = 1;
export const GOLDEN_SECONDS = 1.5;

/**
 * @param {number} resultCount - Number of picks to reveal (results ordered worst pick first, winner last)
 * @param {Object} timings - { mixTimeSeconds, revealHoldSeconds, pauseBetweenPicksSeconds }
 * @returns {Array<{pickIndex: number, phase: string, durationMs: number}>}
 */
export function buildRevealSteps(resultCount, timings) {
  const mixMs = timings.mixTimeSeconds * 1000;
  const revealMs = timings.revealHoldSeconds * 1000;
  const pauseMs = timings.pauseBetweenPicksSeconds * 1000;
  const steps = [];

  for (let pickIndex = 0; pickIndex < resultCount; pickIndex++) {
    const isWinner = pickIndex === resultCount - 1;
    if (isWinner) {
      steps.push({ pickIndex, phase: PHASES.GOLDEN, durationMs: GOLDEN_SECONDS * 1000 });
      steps.push({ pickIndex, phase: PHASES.REVEALING, durationMs: revealMs });
    } else {
      steps.push({ pickIndex, phase: PHASES.MIXING, durationMs: mixMs });
      steps.push({ pickIndex, phase: PHASES.EJECTING, durationMs: EJECT_SECONDS * 1000 });
      steps.push({ pickIndex, phase: PHASES.REVEALING, durationMs: revealMs });
      steps.push({ pickIndex, phase: PHASES.PAUSING, durationMs: pauseMs });
    }
  }

  return steps;
}

/**
 * Total reveal length in seconds for a lottery of `teamCount` teams.
 */
export function estimateRevealSeconds(teamCount, timings) {
  const totalMs = buildRevealSteps(teamCount, timings).reduce((sum, step) => sum + step.durationMs, 0);
  return totalMs / 1000;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/revealTiming.js src/utils/revealTiming.test.js
git commit -m "Add reveal timing model"
```

---

### Task 4: Settings dialog and gear button

**Files:**
- Create: `src/components/SettingsDialog.jsx`
- Modify: `src/App.jsx` (imports; main `Paper` around line 606)
- Test: `src/components/SettingsDialog.test.jsx`

**Interfaces:**
- Consumes: `useSettings` (Task 2), `groupSettingDefinitions` (Task 1), `estimateRevealSeconds` (Task 3), `createMemoryStorage` (Task 2).
- Produces: `SettingsDialog({ lotteryTeamCount?: number })`, which renders the gear `IconButton` (aria-label "Settings") and its dialog.

- [ ] **Step 1: Write the failing dialog tests**

Create `src/components/SettingsDialog.test.jsx`:

```jsx
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
```

(The 5 s estimate is 5 × (5 + 1 + 2 + 0.75) + 1.5 + 2 = 47.25, which rounds to 47.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/SettingsDialog.test.jsx`
Expected: FAIL — cannot resolve `./SettingsDialog`.

- [ ] **Step 3: Implement `src/components/SettingsDialog.jsx`**

```jsx
import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Slider,
  Tooltip,
  Typography,
} from '@mui/material';
import { Settings } from '@mui/icons-material';
import { useSettings } from '../settings/SettingsContext';
import { groupSettingDefinitions } from '../settings/settingsSchema';
import { estimateRevealSeconds } from '../utils/revealTiming';

const ANIMATION_GROUP = 'Lottery Animation';

function formatSettingValue(value, unit) {
  return `${Number(value.toFixed(2))}${unit}`;
}

/**
 * Gear button that opens the settings dialog. Sliders are generated from the settings registry.
 * @param {Object} props
 * @param {number} props.lotteryTeamCount - Teams currently in the lottery, used for the length estimate
 */
export function SettingsDialog({ lotteryTeamCount = 0 }) {
  const [open, setOpen] = useState(false);
  const { settings, updateSetting, resetSettings } = useSettings();

  return (
    <>
      <Tooltip title="Settings">
        <IconButton aria-label="Settings" onClick={() => setOpen(true)}>
          <Settings />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Settings</DialogTitle>
        <DialogContent dividers>
          {groupSettingDefinitions().map(({ group, definitions }) => (
            <Box key={group} sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                {group}
              </Typography>

              {definitions.map(definition => (
                <Box key={definition.key} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <Typography>{definition.label}</Typography>
                    <Typography data-testid={`setting-${definition.key}-value`} sx={{ fontWeight: 'bold' }}>
                      {formatSettingValue(settings[definition.key], definition.unit)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {definition.description}
                  </Typography>
                  <Slider
                    aria-label={definition.label}
                    value={settings[definition.key]}
                    min={definition.min}
                    max={definition.max}
                    step={definition.step}
                    valueLabelDisplay="auto"
                    valueLabelFormat={value => formatSettingValue(value, definition.unit)}
                    onChange={(_, value) => updateSetting(definition.key, value)}
                  />
                </Box>
              ))}

              {group === ANIMATION_GROUP && (
                <Typography variant="body2" color="text.secondary" data-testid="reveal-estimate">
                  {lotteryTeamCount > 0
                    ? `≈ ${Math.round(estimateRevealSeconds(lotteryTeamCount, settings))}s for ${lotteryTeamCount} teams`
                    : 'Load a league to see how long the reveal will take.'}
                </Typography>
              )}
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={resetSettings}>Reset to defaults</Button>
          <Button variant="contained" onClick={() => setOpen(false)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS. If the slider `fireEvent.change` tests fail because MUI's hidden range input ignores the change in jsdom, check the installed `@mui/material` version (`npm ls @mui/material`) and the Slider's hidden-input `onChange` handling before changing the test. Don't weaken the assertions.

- [ ] **Step 5: Add the gear to the main panel in `src/App.jsx`**

Add the import next to the other component imports (after `import { TeamNameWithAvatar } ...`):

```jsx
import { SettingsDialog } from './components/SettingsDialog';
```

Change the main panel `Paper` (currently `<Paper elevation={3} sx={{ p: 4, background: 'rgba(255, 255, 255, 0.95)' }}>`) to be positioned, and put the gear in its top-right corner as the first child:

```jsx
        <Paper elevation={3} sx={{ p: 4, background: 'rgba(255, 255, 255, 0.95)', position: 'relative' }}>
        <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
          <SettingsDialog lotteryTeamCount={teamsToDisplay.length} />
        </Box>
        {/* League Information */}
```

- [ ] **Step 6: Verify build and tests**

Run: `npm test && npm run build`
Expected: all tests PASS; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/SettingsDialog.jsx src/components/SettingsDialog.test.jsx src/App.jsx
git commit -m "Add settings dialog with lottery animation timings"
```

---

### Task 5: Drum physics

**Files:**
- Create: `src/utils/drumPhysics.js`
- Test: `src/utils/drumPhysics.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (from `src/utils/drumPhysics.js`). Coordinates are normalized: the drum radius is 1, the center is (0, 0), and +y points down.
  - `CHUTE = { mouth: { x: 1, y: 0 }, end: { x: 1.9, y: 0.75 } }`
  - `RISE_TARGET = { x: 0, y: -1.25 }`
  - `getBallRadius(count: number): number`
  - `createSeededRng(seed: number): () => number`
  - `createDrumState(ids: string[], { rng? }): { ballRadius: number, balls: Array<{ id, x, y, vx, vy, status: 'inDrum'|'scripted'|'done', script }> }`
  - `step(state, dtSeconds: number, { jetOn?: boolean, rng? }): state`. Mutates `state` in place. `dt` is clamped to [0, 0.05].
  - `startEject(state, id, durationSeconds)`: scripts the ball to the drum mouth, then down the chute. Ends with status `'done'` at `CHUTE.end`.
  - `startRise(state, id, durationSeconds)`: scripts the ball to `RISE_TARGET`. Ends with status `'done'`.
  - Both `start*` functions do nothing for unknown ids or balls that aren't `'inDrum'`.

- [ ] **Step 1: Write the failing physics tests**

Create `src/utils/drumPhysics.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  CHUTE,
  RISE_TARGET,
  createDrumState,
  createSeededRng,
  getBallRadius,
  startEject,
  startRise,
  step,
} from './drumPhysics';

const EPS = 1e-6;
const ids = n => Array.from({ length: n }, (_, i) => `team${i}`);
const distFromCenter = ball => Math.hypot(ball.x, ball.y);
const meanY = state => state.balls.reduce((sum, b) => sum + b.y, 0) / state.balls.length;

function runFrames(state, frames, options) {
  for (let i = 0; i < frames; i++) step(state, 1 / 60, options);
}

function expectAllInside(state) {
  for (const ball of state.balls.filter(b => b.status === 'inDrum')) {
    expect(distFromCenter(ball)).toBeLessThanOrEqual(1 - state.ballRadius + EPS);
  }
}

describe('getBallRadius', () => {
  it('caps the radius for small lotteries and shrinks it for big ones', () => {
    expect(getBallRadius(2)).toBe(0.2);
    expect(getBallRadius(6)).toBe(0.2);
    expect(getBallRadius(12)).toBeLessThan(0.2);
    expect(getBallRadius(20)).toBeLessThan(getBallRadius(12));
  });
});

describe('createSeededRng', () => {
  it('is deterministic and returns values in [0, 1)', () => {
    const a = createSeededRng(7);
    const b = createSeededRng(7);
    for (let i = 0; i < 100; i++) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('createDrumState', () => {
  it.each([2, 6, 12, 16, 20])('places %i balls inside the drum without overlapping', n => {
    const state = createDrumState(ids(n), { rng: createSeededRng(42) });
    const r = state.ballRadius;
    expect(state.balls).toHaveLength(n);
    expectAllInside(state);
    for (const ball of state.balls) expect(ball.status).toBe('inDrum');
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = state.balls[i];
        const b = state.balls[j];
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(2 * r - EPS);
      }
    }
  });
});

describe('step', () => {
  it('keeps every ball inside the drum while the jet runs for a long time', () => {
    const rng = createSeededRng(1);
    const state = createDrumState(ids(12), { rng });
    runFrames(state, 3000, { jetOn: true, rng });
    expectAllInside(state);
  });

  it('lifts and keeps tumbling the balls when the jet is on', () => {
    const jetState = createDrumState(ids(6), { rng: createSeededRng(3) });
    const calmState = createDrumState(ids(6), { rng: createSeededRng(3) });
    runFrames(jetState, 120, { jetOn: true, rng: createSeededRng(4) });
    runFrames(calmState, 120, { jetOn: false, rng: createSeededRng(4) });
    expect(meanY(jetState)).toBeLessThan(meanY(calmState) - 0.15);
    const meanSpeed = jetState.balls.reduce((sum, b) => sum + Math.hypot(b.vx, b.vy), 0) / jetState.balls.length;
    expect(meanSpeed).toBeGreaterThan(0.5);
  });

  it('lets balls settle toward the bottom when the jet turns off', () => {
    const rng = createSeededRng(5);
    const state = createDrumState(ids(6), { rng });
    runFrames(state, 120, { jetOn: true, rng });
    runFrames(state, 300, { jetOn: false, rng });
    expect(meanY(state)).toBeGreaterThan(0.4);
    expectAllInside(state);
  });

  it('pushes overlapping balls apart', () => {
    const state = createDrumState(['a', 'b'], { rng: createSeededRng(9) });
    const [a, b] = state.balls;
    Object.assign(a, { x: 0, y: 0.3, vx: 0, vy: 0 });
    Object.assign(b, { x: 0.01, y: 0.3, vx: 0, vy: 0 });
    step(state, 1 / 60, { jetOn: false, rng: createSeededRng(9) });
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(2 * state.ballRadius - EPS);
  });

  it('separates balls sitting exactly on top of each other', () => {
    const state = createDrumState(['a', 'b'], { rng: createSeededRng(9) });
    const [a, b] = state.balls;
    Object.assign(a, { x: 0, y: 0, vx: 0, vy: 0 });
    Object.assign(b, { x: 0, y: 0, vx: 0, vy: 0 });
    step(state, 1 / 60, { jetOn: false, rng: createSeededRng(9) });
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.1);
  });

  it('does not let a huge time jump (e.g. a background tab) push balls through the wall', () => {
    const rng = createSeededRng(11);
    const state = createDrumState(ids(6), { rng });
    Object.assign(state.balls[0], { x: 0.7, y: 0, vx: 50, vy: 0 });
    step(state, 5, { jetOn: true, rng });
    expectAllInside(state);
  });

  it('does nothing for zero, negative, or NaN time', () => {
    const state = createDrumState(ids(4), { rng: createSeededRng(2) });
    const before = JSON.stringify(state);
    step(state, 0);
    step(state, -1);
    step(state, NaN);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('startEject', () => {
  it('sends only the chosen ball out of the mouth and down the chute', () => {
    const rng = createSeededRng(21);
    const state = createDrumState(ids(6), { rng });
    const target = state.balls.find(b => b.id === 'team2');
    startEject(state, 'team2', 1);
    expect(target.status).toBe('scripted');

    for (let frame = 0; frame < 70; frame++) {
      step(state, 1 / 60, { jetOn: true, rng });
      // On its way out the ball is either still inside the drum or already past the mouth
      const inside = distFromCenter(target) <= 1 - state.ballRadius + EPS;
      expect(inside || target.x >= 1 - state.ballRadius - EPS).toBe(true);
    }

    expect(target.status).toBe('done');
    expect(target.x).toBeCloseTo(CHUTE.end.x, 5);
    expect(target.y).toBeCloseTo(CHUTE.end.y, 5);
    for (const ball of state.balls.filter(b => b.id !== 'team2')) expect(ball.status).toBe('inDrum');
    expectAllInside(state);
  });

  it('ignores unknown ids and balls that already left', () => {
    const state = createDrumState(ids(3), { rng: createSeededRng(4) });
    expect(() => startEject(state, 'nope', 1)).not.toThrow();
    startEject(state, 'team0', 1);
    runFrames(state, 70, { jetOn: false });
    startEject(state, 'team0', 1);
    expect(state.balls[0].status).toBe('done');
  });
});

describe('startRise', () => {
  it('floats the golden ball up to the rise point', () => {
    const state = createDrumState(ids(1), { rng: createSeededRng(8) });
    startRise(state, 'team0', 1.5);
    runFrames(state, 100, { jetOn: false });
    const ball = state.balls[0];
    expect(ball.status).toBe('done');
    expect(ball.x).toBeCloseTo(RISE_TARGET.x, 5);
    expect(ball.y).toBeCloseTo(RISE_TARGET.y, 5);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/drumPhysics.test.js`
Expected: FAIL — cannot resolve `./drumPhysics`.

- [ ] **Step 3: Implement `src/utils/drumPhysics.js`**

```js
/**
 * Lightweight 2D physics for the lottery ball machine.
 *
 * Coordinates are normalized: the drum is a circle of radius 1 centered at (0, 0) and
 * +y points down (screen coordinates). BallMachine multiplies by its pixel scale.
 * step() mutates the state in place so the render loop doesn't allocate every frame.
 */

// Where a drawn ball leaves the drum and where it comes to rest at the bottom of the chute
export const CHUTE = {
  mouth: { x: 1, y: 0 },
  end: { x: 1.9, y: 0.75 },
};

// Where the golden #1 ball floats to, just above the drum
export const RISE_TARGET = { x: 0, y: -1.25 };

// Tuning constants (units: drum radii and seconds)
const GRAVITY = 3;
const JET_LIFT = 4.6; // upward push on balls in the lower half while the jet runs
const SWIRL = 2.5; // sideways push around the drum while the jet runs
const JITTER = 40; // random kicks while the jet runs
const MAX_SPEED = 3.5;
const WALL_RESTITUTION = 0.75;
const BALL_RESTITUTION = 0.9;
const SETTLE_DAMPING = 1.5; // velocity decay per second with the jet off
const MAX_FRAME_DT = 0.05;
const SUBSTEP_DT = 1 / 240;
const MAX_BALL_RADIUS = 0.2;
const PACKING = 0.25; // fraction of the drum's area covered by balls
const PLACEMENT_ATTEMPTS = 500;
const EJECT_GLIDE_FRACTION = 0.4; // share of the eject spent gliding to the mouth

export function getBallRadius(count) {
  if (count <= 0) return MAX_BALL_RADIUS;
  return Math.min(MAX_BALL_RADIUS, Math.sqrt(PACKING / count));
}

/**
 * Deterministic random number generator (mulberry32) so tests can replay the same tumble.
 */
export function createSeededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create one ball per id, scattered inside the drum without overlapping.
 */
export function createDrumState(ids, { rng = Math.random } = {}) {
  const ballRadius = getBallRadius(ids.length);
  const maxDist = 1 - ballRadius;
  const balls = [];

  for (const id of ids) {
    let x = 0;
    let y = 0;
    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
      const angle = rng() * Math.PI * 2;
      const dist = Math.sqrt(rng()) * maxDist;
      x = Math.cos(angle) * dist;
      y = Math.sin(angle) * dist;
      if (balls.every(b => Math.hypot(b.x - x, b.y - y) >= 2 * ballRadius)) break;
    }
    balls.push({ id, x, y, vx: 0, vy: 0, status: 'inDrum', script: null });
  }

  return { ballRadius, balls };
}

export function startEject(state, id, durationSeconds) {
  startScript(state, id, 'eject', durationSeconds);
}

export function startRise(state, id, durationSeconds) {
  startScript(state, id, 'rise', durationSeconds);
}

/**
 * Advance the simulation. Large time jumps are clamped and split into small substeps
 * so fast balls can't tunnel through the drum wall.
 */
export function step(state, dt, { jetOn = false, rng = Math.random } = {}) {
  let remaining = Math.min(Math.max(dt, 0), MAX_FRAME_DT);
  while (remaining > 1e-9) {
    const h = Math.min(SUBSTEP_DT, remaining);
    substep(state, h, jetOn, rng);
    remaining -= h;
  }
  return state;
}

function startScript(state, id, kind, durationSeconds) {
  const ball = state.balls.find(b => b.id === id);
  if (!ball || ball.status !== 'inDrum') return;
  ball.status = 'scripted';
  ball.vx = 0;
  ball.vy = 0;
  ball.script = {
    kind,
    fromX: ball.x,
    fromY: ball.y,
    elapsed: 0,
    duration: Math.max(durationSeconds, 0.001),
  };
}

function substep(state, h, jetOn, rng) {
  const r = state.ballRadius;
  const free = [];

  for (const ball of state.balls) {
    if (ball.status === 'scripted') {
      advanceScript(ball, r, h);
      continue;
    }
    if (ball.status !== 'inDrum') continue;
    free.push(ball);

    let ax = 0;
    let ay = GRAVITY;
    if (jetOn) {
      if (ball.y > 0) ay -= JET_LIFT;
      const dist = Math.hypot(ball.x, ball.y) || 1;
      ax += SWIRL * (ball.y / dist);
      ay += SWIRL * (-ball.x / dist);
      ball.vx += (rng() - 0.5) * JITTER * h;
      ball.vy += (rng() - 0.5) * JITTER * h;
    }

    ball.vx += ax * h;
    ball.vy += ay * h;
    if (!jetOn) {
      const decay = Math.exp(-SETTLE_DAMPING * h);
      ball.vx *= decay;
      ball.vy *= decay;
    }
    clampSpeed(ball);
    ball.x += ball.vx * h;
    ball.y += ball.vy * h;
  }

  resolveBallCollisions(free, r, rng);
  for (const ball of free) constrainToDrum(ball, r);
}

function clampSpeed(ball) {
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > MAX_SPEED) {
    ball.vx *= MAX_SPEED / speed;
    ball.vy *= MAX_SPEED / speed;
  }
}

function resolveBallCollisions(balls, r, rng) {
  const minDist = 2 * r;
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i];
      const b = balls[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.hypot(dx, dy);
      if (dist >= minDist) continue;

      // Exactly stacked balls have no direction to separate along, so pick one at random
      if (dist < 1e-9) {
        const angle = rng() * Math.PI * 2;
        dx = Math.cos(angle);
        dy = Math.sin(angle);
        dist = 0;
      }
      const length = dist || 1;
      const nx = dx / length;
      const ny = dy / length;
      const overlap = minDist - dist;

      a.x -= (nx * overlap) / 2;
      a.y -= (ny * overlap) / 2;
      b.x += (nx * overlap) / 2;
      b.y += (ny * overlap) / 2;

      const approachSpeed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (approachSpeed < 0) {
        const impulse = (-(1 + BALL_RESTITUTION) * approachSpeed) / 2;
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;
      }
    }
  }
}

function constrainToDrum(ball, r) {
  const maxDist = 1 - r;
  const dist = Math.hypot(ball.x, ball.y);
  if (dist <= maxDist) return;
  const nx = ball.x / dist;
  const ny = ball.y / dist;
  ball.x = nx * maxDist;
  ball.y = ny * maxDist;
  const outwardSpeed = ball.vx * nx + ball.vy * ny;
  if (outwardSpeed > 0) {
    ball.vx -= (1 + WALL_RESTITUTION) * outwardSpeed * nx;
    ball.vy -= (1 + WALL_RESTITUTION) * outwardSpeed * ny;
  }
}

function advanceScript(ball, r, h) {
  const script = ball.script;
  script.elapsed = Math.min(script.elapsed + h, script.duration);
  const position = getScriptedPosition(script, r, script.elapsed / script.duration);
  ball.x = position.x;
  ball.y = position.y;
  if (script.elapsed >= script.duration) ball.status = 'done';
}

function getScriptedPosition(script, r, t) {
  if (script.kind === 'rise') {
    const e = easeInOut(t);
    return { x: lerp(script.fromX, RISE_TARGET.x, e), y: lerp(script.fromY, RISE_TARGET.y, e) };
  }

  // Eject: glide to the inside of the mouth, then roll down the chute, speeding up like it's downhill
  const mouthX = CHUTE.mouth.x - r;
  const mouthY = CHUTE.mouth.y;
  if (t < EJECT_GLIDE_FRACTION) {
    const e = easeInOut(t / EJECT_GLIDE_FRACTION);
    return { x: lerp(script.fromX, mouthX, e), y: lerp(script.fromY, mouthY, e) };
  }
  const e = easeIn((t - EJECT_GLIDE_FRACTION) / (1 - EJECT_GLIDE_FRACTION));
  return { x: lerp(mouthX, CHUTE.end.x, e), y: lerp(mouthY, CHUTE.end.y, e) };
}

function lerp(from, to, t) {
  return from + (to - from) * t;
}

function easeIn(t) {
  return t * t;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS. If "lifts and keeps tumbling" or "settle toward the bottom" fails, adjust only the tuning constants (`JET_LIFT`, `SWIRL`, `JITTER`, `SETTLE_DAMPING`) and keep the assertions. Those two tests define the visual behavior we want.

- [ ] **Step 5: Commit**

```bash
git add src/utils/drumPhysics.js src/utils/drumPhysics.test.js
git commit -m "Add drum physics for the ball machine"
```

---

### Task 6: Reveal sequence hook

**Files:**
- Create: `src/test/advanceTime.js`
- Create: `src/hooks/useRevealSequence.js`
- Test: `src/hooks/useRevealSequence.test.jsx`

**Interfaces:**
- Consumes: `buildRevealSteps`, `PHASES` (Task 3).
- Produces:
  - `useRevealSequence(resultCount: number, timings): { pickIndex: number, phase: string, revealedCount: number, isComplete: boolean }`
    - `phase` is one of the `PHASES` values. It's `'complete'` once finished.
    - `revealedCount` is how many picks have finished their reveal, which is how many belong on the draft board.
    - `timings` are captured on mount. Later changes are ignored until the hook remounts.
  - Test helper `advanceTime(ms: number, slice = 10)` from `src/test/advanceTime.js`.

- [ ] **Step 1: Create the fake-timer helper `src/test/advanceTime.js`**

```js
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
```

- [ ] **Step 2: Write the failing hook tests**

Create `src/hooks/useRevealSequence.test.jsx`:

```jsx
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRevealSequence } from './useRevealSequence';
import { advanceTime } from '../test/advanceTime';

// Per regular pick: 2000 mix + 1000 eject + 3000 reveal + 500 pause = 6500ms
const timings = { mixTimeSeconds: 2, revealHoldSeconds: 3, pauseBetweenPicksSeconds: 0.5 };

describe('useRevealSequence', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts by mixing for the first (worst) pick', () => {
    const { result } = renderHook(() => useRevealSequence(3, timings));
    expect(result.current).toEqual({ pickIndex: 0, phase: 'mixing', revealedCount: 0, isComplete: false });
  });

  it('moves through the phases on the configured clock', () => {
    const { result } = renderHook(() => useRevealSequence(3, timings));
    advanceTime(1999);
    expect(result.current.phase).toBe('mixing');
    advanceTime(1);
    expect(result.current.phase).toBe('ejecting');
    advanceTime(1000);
    expect(result.current.phase).toBe('revealing');
    expect(result.current.revealedCount).toBe(0);
    advanceTime(3000);
    expect(result.current.phase).toBe('pausing');
    expect(result.current.revealedCount).toBe(1);
    advanceTime(500);
    expect(result.current).toMatchObject({ pickIndex: 1, phase: 'mixing' });
  });

  it('gives the last pick the golden ball instead of a draw, then completes', () => {
    const { result } = renderHook(() => useRevealSequence(3, timings));
    advanceTime(2 * 6500);
    expect(result.current).toMatchObject({ pickIndex: 2, phase: 'golden' });
    advanceTime(1500);
    expect(result.current).toMatchObject({ pickIndex: 2, phase: 'revealing', revealedCount: 2 });
    advanceTime(3000);
    expect(result.current).toEqual({ pickIndex: 2, phase: 'complete', revealedCount: 3, isComplete: true });
  });

  it('keeps the timings it started with', () => {
    const { result, rerender } = renderHook(({ t }) => useRevealSequence(3, t), { initialProps: { t: timings } });
    rerender({ t: { ...timings, mixTimeSeconds: 10 } });
    advanceTime(2000);
    expect(result.current.phase).toBe('ejecting');
  });

  it('stops all timers when unmounted', () => {
    const { unmount } = renderHook(() => useRevealSequence(3, timings));
    advanceTime(2500);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/hooks/useRevealSequence.test.jsx`
Expected: FAIL — cannot resolve `./useRevealSequence`.

- [ ] **Step 4: Implement `src/hooks/useRevealSequence.js`**

```js
import { useEffect, useState } from 'react';
import { PHASES, buildRevealSteps } from '../utils/revealTiming';

/**
 * Walks the reveal one step at a time on a timer.
 *
 * Timings are captured when the reveal starts; the settings menu sits behind the
 * lottery popup, so they can't change mid-reveal anyway.
 *
 * @param {number} resultCount - Number of picks (results ordered worst pick first, winner last)
 * @param {Object} timings - { mixTimeSeconds, revealHoldSeconds, pauseBetweenPicksSeconds }
 */
export function useRevealSequence(resultCount, timings) {
  const [steps] = useState(() => buildRevealSteps(resultCount, timings));
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (stepIndex >= steps.length) return undefined;
    const timer = setTimeout(() => setStepIndex(index => index + 1), steps[stepIndex].durationMs);
    return () => clearTimeout(timer);
  }, [stepIndex, steps]);

  const isComplete = stepIndex >= steps.length;
  const current = isComplete ? null : steps[stepIndex];
  const revealedCount = steps.slice(0, stepIndex).filter(step => step.phase === PHASES.REVEALING).length;

  return {
    pickIndex: current ? current.pickIndex : resultCount - 1,
    phase: current ? current.phase : PHASES.COMPLETE,
    revealedCount,
    isComplete,
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/test/advanceTime.js src/hooks/useRevealSequence.js src/hooks/useRevealSequence.test.jsx
git commit -m "Add reveal sequence hook"
```

---

### Task 7: BallMachine component

**Files:**
- Create: `src/components/BallMachine.jsx`
- Test: `src/components/BallMachine.test.jsx`

**Interfaces:**
- Consumes: `CHUTE`, `createDrumState`, `startEject`, `startRise`, `step` (Task 5); `EJECT_SECONDS`, `GOLDEN_SECONDS` (Task 3); existing `TeamAvatar({ avatar, teamName, size })`.
- Produces: `BallMachine({ teams, jetOn, ejectId?, riseId?, hiddenIds?, drumRadiusPx?, children? })`
  - `teams: Array<{ userId, teamName, avatar }>`. It's read once on mount to create the drum.
  - `ejectId`: when it changes to a team id, that ball is ejected down the chute.
  - `riseId`: when set, that ball glows gold (`data-golden="true"`) and rises out of the drum.
  - `hiddenIds`: balls to hide (`data-hidden="true"`), meaning teams already revealed.
  - `children`: overlay content rendered centered on the drum.
  - Ball elements have `data-testid="drum-ball-<userId>"`; the root has `data-testid="ball-machine"`.

- [ ] **Step 1: Write the failing component tests**

Create `src/components/BallMachine.test.jsx`:

```jsx
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/BallMachine.test.jsx`
Expected: FAIL — cannot resolve `./BallMachine`.

- [ ] **Step 3: Implement `src/components/BallMachine.jsx`**

```jsx
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { TeamAvatar } from './TeamAvatar';
import { CHUTE, createDrumState, startEject, startRise, step } from '../utils/drumPhysics';
import { EJECT_SECONDS, GOLDEN_SECONDS } from '../utils/revealTiming';

// Normalized area around the drum (radius 1) that also fits the chute and the golden ball's rise point
const VIEW = { minX: -1.15, minY: -1.5, width: 3.3, height: 2.65 };

/**
 * Glass lottery drum with one avatar ball per team, animated by drumPhysics.
 * Ball positions are written straight to the DOM each frame (no React re-render per frame).
 */
export function BallMachine({ teams, jetOn, ejectId = null, riseId = null, hiddenIds = [], drumRadiusPx = 120, children }) {
  const [drum] = useState(() => createDrumState(teams.map(team => team.userId)));
  const ballElements = useRef(new Map());
  const jetOnRef = useRef(jetOn);
  jetOnRef.current = jetOn;

  useEffect(() => {
    if (ejectId) startEject(drum, ejectId, EJECT_SECONDS);
  }, [drum, ejectId]);

  useEffect(() => {
    if (riseId) startRise(drum, riseId, GOLDEN_SECONDS);
  }, [drum, riseId]);

  useLayoutEffect(() => {
    let frameId = null;
    let lastTime = null;

    const render = () => {
      for (const ball of drum.balls) {
        const element = ballElements.current.get(ball.id);
        if (!element) continue;
        const left = (ball.x - VIEW.minX - drum.ballRadius) * drumRadiusPx;
        const top = (ball.y - VIEW.minY - drum.ballRadius) * drumRadiusPx;
        element.style.transform = `translate(${left}px, ${top}px)`;
      }
    };

    const tick = now => {
      if (lastTime !== null) step(drum, (now - lastTime) / 1000, { jetOn: jetOnRef.current });
      lastTime = now;
      render();
      frameId = requestAnimationFrame(tick);
    };

    render();
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [drum, drumRadiusPx]);

  const ballSizePx = drum.ballRadius * 2 * drumRadiusPx;
  const hidden = new Set(hiddenIds);

  return (
    <Box
      data-testid="ball-machine"
      sx={{
        position: 'relative',
        width: VIEW.width * drumRadiusPx,
        height: VIEW.height * drumRadiusPx,
        mx: 'auto',
        flexShrink: 0,
      }}
    >
      <svg
        width={VIEW.width * drumRadiusPx}
        height={VIEW.height * drumRadiusPx}
        viewBox={`${VIEW.minX} ${VIEW.minY} ${VIEW.width} ${VIEW.height}`}
        style={{ position: 'absolute', inset: 0 }}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="drum-glass" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.45)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0.08)" />
          </radialGradient>
        </defs>
        {/* Chute: a tube from the drum mouth down to the right */}
        <line
          x1={CHUTE.mouth.x - 0.1}
          y1={CHUTE.mouth.y}
          x2={CHUTE.end.x}
          y2={CHUTE.end.y}
          stroke="rgba(255, 255, 255, 0.7)"
          strokeWidth={drum.ballRadius * 2 + 0.08}
          strokeLinecap="round"
        />
        <line
          x1={CHUTE.mouth.x - 0.1}
          y1={CHUTE.mouth.y}
          x2={CHUTE.end.x}
          y2={CHUTE.end.y}
          stroke="rgba(30, 30, 60, 0.55)"
          strokeWidth={drum.ballRadius * 2 + 0.02}
          strokeLinecap="round"
        />
        {/* Stand */}
        <path d="M -0.45 0.97 L -0.6 1.12 L 0.6 1.12 L 0.45 0.97 Z" fill="rgba(0, 0, 0, 0.35)" />
        {/* Glass drum */}
        <circle cx="0" cy="0" r="1" fill="url(#drum-glass)" stroke="rgba(255, 255, 255, 0.85)" strokeWidth="0.03" />
      </svg>

      {teams.map(team => {
        const isGolden = team.userId === riseId;
        const isHidden = hidden.has(team.userId);
        return (
          <Box
            key={team.userId}
            ref={element => {
              if (element) ballElements.current.set(team.userId, element);
              else ballElements.current.delete(team.userId);
            }}
            data-testid={`drum-ball-${team.userId}`}
            data-golden={isGolden ? 'true' : undefined}
            data-hidden={isHidden ? 'true' : undefined}
            sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: ballSizePx,
              height: ballSizePx,
              borderRadius: '50%',
              bgcolor: 'white',
              display: isHidden ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: isGolden ? '3px solid gold' : 'none',
              boxShadow: isGolden
                ? '0 0 18px 6px rgba(255, 215, 0, 0.9)'
                : 'inset -4px -6px 10px rgba(0, 0, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.4)',
              willChange: 'transform',
            }}
          >
            <TeamAvatar avatar={team.avatar} teamName={team.teamName} size={Math.round(ballSizePx * 0.78)} />
          </Box>
        );
      })}

      {children && (
        <Box
          sx={{
            position: 'absolute',
            left: -VIEW.minX * drumRadiusPx,
            top: -VIEW.minY * drumRadiusPx,
            transform: 'translate(-50%, -50%)',
            zIndex: 2,
          }}
        >
          {children}
        </Box>
      )}
    </Box>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/BallMachine.jsx src/components/BallMachine.test.jsx
git commit -m "Add BallMachine drum component"
```

---

### Task 8: Rewrite the reveal popup and wire it into App

**Files:**
- Rewrite: `src/components/SelectionAnimation.jsx`
- Modify: `src/App.jsx` (state block lines 50–60, `handleLoadTeams` ~line 103, `handleRunLottery` lines 294–340, `handleStartAnimation` lines 342–471, `handleReset` ~line 474, `handleCancelAnimation` lines 485–499, `handleSkipAnimation` lines 501–547, `<Dialog>` lines 755–784)
- Test: `src/components/SelectionAnimation.test.jsx`

**Interfaces:**
- Consumes: `useSettings` (Task 2); `PHASES` (Task 3); `useRevealSequence` (Task 6); `BallMachine` (Task 7); `createMemoryStorage` (Task 2); `advanceTime` (Task 6); `SETTINGS_STORAGE_KEY` (Task 1).
- Produces: `SelectionAnimation({ results, animationStarted, onStart, onComplete, onSkip, leagueName })`
  - `results`: the complete `runNBALottery()` output. Each item has `{ userId, teamName, avatar, pickNumber, position }`.
  - `onComplete()`: called once when the reveal finishes on its own.
  - `onSkip()`: called by "Skip to Results" or, after completion, by "View Results".
  - The old `selection`, `selections`, `totalTeams`, and `onClose` props are removed.

- [ ] **Step 1: Write the failing popup tests**

Create `src/components/SelectionAnimation.test.jsx`:

```jsx
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/SelectionAnimation.test.jsx`
Expected: FAIL — the start screen test may pass, but the reveal tests fail (no `reveal-headline` test id, old props).

- [ ] **Step 3: Rewrite `src/components/SelectionAnimation.jsx`**

Replace the whole file with:

```jsx
import React, { useEffect, useMemo, useRef } from 'react';
import { Box, Paper, Typography, Button, useMediaQuery } from '@mui/material';
import { PlayArrow, SkipNext } from '@mui/icons-material';
import confetti from 'canvas-confetti';
import { TeamAvatar } from './TeamAvatar';
import { BallMachine } from './BallMachine';
import { useSettings } from '../settings/SettingsContext';
import { useRevealSequence } from '../hooks/useRevealSequence';
import { PHASES } from '../utils/revealTiming';

const TEXT_OUTLINE = `
  -2px -2px 0 #000,
  2px -2px 0 #000,
  -2px 2px 0 #000,
  2px 2px 0 #000,
  0 0 4px #000,
  0 0 4px #000
`;

const PAPER_BACKGROUND_SX = {
  backgroundImage: 'url(/istockphoto-2167499398-612x612.jpg)',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  color: 'white',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.3)',
    zIndex: 0,
  },
};

const CONFETTI_MS = 6000;

function getPickLabel(pickNumber) {
  return pickNumber === 1 ? '🏆 Pick #1' : `Pick #${pickNumber}`;
}

function getHeadline(phase, selection, remainingCount) {
  switch (phase) {
    case PHASES.MIXING:
    case PHASES.EJECTING:
      return remainingCount === 2 ? 'Two teams left…' : `Drawing Pick #${selection.pickNumber}…`;
    case PHASES.GOLDEN:
      return 'And the #1 pick goes to…';
    case PHASES.REVEALING:
      return getPickLabel(selection.pickNumber);
    case PHASES.PAUSING:
      return `Up next: Pick #${selection.pickNumber - 1}`;
    default:
      return '🏆 The draft order is set!';
  }
}

// More teams = smaller draft-board cards so the row fits
function getBoardSizes(numTeams) {
  if (numTeams <= 6) return { avatarSize: 56, cardWidth: 110, gap: 12 };
  if (numTeams <= 10) return { avatarSize: 48, cardWidth: 96, gap: 10 };
  if (numTeams <= 14) return { avatarSize: 40, cardWidth: 84, gap: 8 };
  return { avatarSize: 34, cardWidth: 74, gap: 6 };
}

function useWinnerConfetti(active) {
  useEffect(() => {
    if (!active) return undefined;
    const end = Date.now() + CONFETTI_MS;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };
    const interval = setInterval(() => {
      const timeLeft = end - Date.now();
      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }
      confetti({
        ...defaults,
        particleCount: 50 * (timeLeft / CONFETTI_MS),
        origin: { x: 0.1 + Math.random() * 0.8, y: Math.random() - 0.2 },
      });
    }, 250);
    return () => {
      clearInterval(interval);
      confetti.reset();
    };
  }, [active]);
}

function StartScreen({ leagueName, onStart }) {
  return (
    <Box sx={{ textAlign: 'center', p: 4, position: 'relative' }}>
      <Paper
        elevation={8}
        sx={{
          ...PAPER_BACKGROUND_SX,
          p: 6,
          minHeight: '50vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Typography
          variant="h3"
          sx={{
            fontWeight: 'bold',
            mb: 6,
            color: 'white !important',
            position: 'relative',
            zIndex: 1,
            textShadow: TEXT_OUTLINE,
          }}
        >
          The {leagueName} Draft Lottery
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={onStart}
          startIcon={<PlayArrow />}
          sx={{
            px: 6,
            py: 2,
            fontSize: '1.2rem',
            bgcolor: 'white',
            color: '#667eea',
            position: 'relative',
            zIndex: 1,
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.9)',
            },
          }}
        >
          Start Lottery
        </Button>
      </Paper>
    </Box>
  );
}

// The drawn ball pops up over the drum and its shell splits open to show the team
function RevealedBall({ selection, sizePx }) {
  const isWinner = selection.pickNumber === 1;
  const shellColor = isWinner ? 'gold' : 'white';
  const halfShell = {
    position: 'absolute',
    left: 0,
    width: '100%',
    height: '50%',
    bgcolor: shellColor,
    boxShadow: 'inset 0 0 18px rgba(0, 0, 0, 0.25)',
  };

  return (
    <Box
      data-testid="revealed-ball"
      sx={{
        position: 'relative',
        width: sizePx,
        height: sizePx,
        animation: 'revealPop 0.4s ease-out both',
        '@keyframes revealPop': {
          '0%': { transform: 'scale(0.2)', opacity: 0 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          bgcolor: 'rgba(0, 0, 0, 0.8)',
          border: `4px solid ${shellColor}`,
          boxShadow: isWinner ? '0 0 40px 12px rgba(255, 215, 0, 0.7)' : '0 0 24px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
          p: 2,
        }}
      >
        <TeamAvatar avatar={selection.avatar} teamName={selection.teamName} size={Math.round(sizePx * 0.32)} />
        <Typography sx={{ color: shellColor, fontWeight: 'bold', fontSize: sizePx > 180 ? '1.4rem' : '1.1rem' }}>
          {getPickLabel(selection.pickNumber)}
        </Typography>
        <Typography
          sx={{
            color: 'white',
            fontWeight: 'bold',
            textAlign: 'center',
            lineHeight: 1.2,
            maxWidth: sizePx * 0.8,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontSize: sizePx > 180 ? '1.1rem' : '0.9rem',
          }}
        >
          {selection.teamName}
        </Typography>
      </Box>
      <Box
        sx={{
          ...halfShell,
          top: 0,
          borderRadius: `${sizePx / 2}px ${sizePx / 2}px 0 0`,
          animation: 'shellTop 0.8s ease-in 0.4s both',
          '@keyframes shellTop': {
            '0%': { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
            '100%': { transform: 'translateY(-90%) rotate(-25deg)', opacity: 0 },
          },
        }}
      />
      <Box
        sx={{
          ...halfShell,
          bottom: 0,
          borderRadius: `0 0 ${sizePx / 2}px ${sizePx / 2}px`,
          animation: 'shellBottom 0.8s ease-in 0.4s both',
          '@keyframes shellBottom': {
            '0%': { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
            '100%': { transform: 'translateY(90%) rotate(20deg)', opacity: 0 },
          },
        }}
      />
    </Box>
  );
}

// Revealed picks, filling in from the right (last pick) toward #1
function DraftBoard({ selections, totalTeams }) {
  const { avatarSize, cardWidth, gap } = getBoardSizes(totalTeams);

  return (
    <Box
      data-testid="draft-board"
      sx={{
        display: 'flex',
        flexDirection: 'row-reverse',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        alignContent: 'flex-start',
        gap: `${gap}px`,
        width: '100%',
        minHeight: avatarSize + 80,
        px: 2,
        position: 'relative',
        zIndex: 1,
      }}
    >
      {selections.map(sel => {
        const isWinner = sel.pickNumber === 1;
        return (
          <Box
            key={`${sel.userId}-${sel.pickNumber}`}
            sx={{
              width: cardWidth,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
              p: 1.5,
              borderRadius: 2,
              bgcolor: isWinner ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
              border: isWinner ? '2px solid gold' : 'none',
              animation: 'boardPop 0.5s ease-out both',
              '@keyframes boardPop': {
                '0%': { opacity: 0, transform: 'scale(0.3)' },
                '100%': { opacity: 1, transform: 'scale(1)' },
              },
            }}
          >
            <TeamAvatar avatar={sel.avatar} teamName={sel.teamName} size={avatarSize} />
            <Typography
              sx={{
                color: 'white',
                fontWeight: isWinner ? 'bold' : 'normal',
                textAlign: 'center',
                maxWidth: cardWidth - 16,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: totalTeams <= 6 ? '1rem' : totalTeams <= 10 ? '0.9rem' : '0.75rem',
              }}
            >
              {sel.teamName}
            </Typography>
            <Typography
              sx={{
                color: isWinner ? 'gold' : 'rgba(255, 255, 255, 0.9)',
                fontWeight: 'bold',
                fontSize: totalTeams <= 6 ? '1.25rem' : '1rem',
              }}
            >
              {getPickLabel(sel.pickNumber)}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

function RevealStage({ results, onComplete, onSkip, leagueName }) {
  const { settings } = useSettings();
  const { pickIndex, phase, revealedCount, isComplete } = useRevealSequence(results.length, settings);
  const isSmallScreen = useMediaQuery('(max-width:600px)');
  const drumRadiusPx = isSmallScreen ? 80 : 120;

  const current = results[pickIndex];
  const isWinnerPick = current.pickNumber === 1;
  const ballIsOut = phase === PHASES.REVEALING || phase === PHASES.PAUSING || isComplete;
  const showReveal = phase === PHASES.REVEALING || isComplete;

  // Call onComplete exactly once, even if the parent passes a new callback later
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  useEffect(() => {
    if (isComplete) onCompleteRef.current?.();
  }, [isComplete]);

  useWinnerConfetti(isWinnerPick && showReveal);

  const hiddenIds = results.slice(0, pickIndex).map(sel => sel.userId);
  if (ballIsOut) hiddenIds.push(current.userId);

  return (
    <Box sx={{ textAlign: 'center', p: { xs: 1, md: 3 }, position: 'relative' }}>
      <Paper
        elevation={8}
        sx={{
          ...PAPER_BACKGROUND_SX,
          p: { xs: 2, md: 4 },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography
          variant="h5"
          sx={{ color: 'white', fontWeight: 'bold', position: 'relative', zIndex: 1, textShadow: TEXT_OUTLINE }}
        >
          The {leagueName} Draft Lottery
        </Typography>
        <Typography
          data-testid="reveal-headline"
          variant="h3"
          sx={{
            color: 'white',
            fontWeight: 'bold',
            mt: 1,
            minHeight: { xs: 40, md: 56 },
            fontSize: { xs: '1.75rem', md: '3rem' },
            position: 'relative',
            zIndex: 1,
            textShadow: TEXT_OUTLINE,
          }}
        >
          {getHeadline(phase, current, results.length - pickIndex)}
        </Typography>

        <Box sx={{ position: 'relative', zIndex: 1, my: 2, maxWidth: '100%' }}>
          <BallMachine
            teams={results}
            jetOn={phase === PHASES.MIXING || phase === PHASES.EJECTING}
            ejectId={phase === PHASES.EJECTING ? current.userId : null}
            riseId={isWinnerPick ? current.userId : null}
            hiddenIds={hiddenIds}
            drumRadiusPx={drumRadiusPx}
          >
            {showReveal && <RevealedBall key={current.pickNumber} selection={current} sizePx={drumRadiusPx * 1.7} />}
          </BallMachine>
        </Box>

        <DraftBoard selections={results.slice(0, revealedCount)} totalTeams={results.length} />

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          <Button
            variant="outlined"
            onClick={onSkip}
            startIcon={<SkipNext />}
            sx={{
              px: 4,
              py: 1.5,
              fontSize: '1rem',
              borderColor: 'rgba(255, 255, 255, 0.5)',
              color: 'white',
              bgcolor: 'rgba(0, 0, 0, 0.3)',
              '&:hover': {
                borderColor: 'rgba(255, 255, 255, 0.8)',
                bgcolor: 'rgba(0, 0, 0, 0.5)',
              },
            }}
          >
            {isComplete ? 'View Results' : 'Skip to Results'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

/**
 * Lottery reveal popup: a start screen, then the ball machine reveal.
 * @param {Object} props
 * @param {Array} props.results - Full lottery results from runNBALottery (worst pick first, winner last)
 * @param {boolean} props.animationStarted - Whether the reveal has started
 * @param {Function} props.onStart - Start the lottery
 * @param {Function} props.onComplete - Called once when the reveal finishes on its own
 * @param {Function} props.onSkip - Skip to (or, after completion, view) the results
 * @param {string} props.leagueName - Name of the league from Sleeper API
 */
export function SelectionAnimation({ results = [], animationStarted, onStart, onComplete, onSkip, leagueName = 'Fantasy Football' }) {
  // Worst pick first so the reveal ends on #1, whatever order the array arrives in
  const orderedResults = useMemo(() => [...results].sort((a, b) => b.pickNumber - a.pickNumber), [results]);

  if (!animationStarted) {
    return <StartScreen leagueName={leagueName} onStart={onStart} />;
  }
  // App sets the results before starting the reveal, so this is only a safety net
  if (orderedResults.length === 0) return null;

  return <RevealStage results={orderedResults} onComplete={onComplete} onSkip={onSkip} leagueName={leagueName} />;
}
```

- [ ] **Step 4: Run the popup tests to verify they pass**

Run: `npx vitest run src/components/SelectionAnimation.test.jsx`
Expected: PASS.

- [ ] **Step 5: Update `src/App.jsx` state**

In the state block, delete these three lines:

```jsx
  const [currentSelection, setCurrentSelection] = useState(null);
```
```jsx
  const [confettiInterval, setConfettiInterval] = useState(null);
```
```jsx
  const skipAnimationRef = useRef(false);
```

In `handleLoadTeams`, delete the line `setCurrentSelection(null);`.

- [ ] **Step 6: Simplify the end of `handleRunLottery`**

Replace the end of `handleRunLottery`, from `setError(null);` through its closing `}, [teams, lotterySlots, confettiInterval]);`, with:

```jsx
    setError(null);
    setTeamsForLottery(teamsWithCombinations);
    setSelections([]);
    setShowResults(false);
    setAnimationStarted(false);
    setShowAnimation(true);
    setFullLotteryResults([]);
  }, [teams, lotterySlots]);
```

- [ ] **Step 7: Replace `handleStartAnimation` and add `handleRevealComplete`**

Replace the whole `handleStartAnimation` callback, from the `// Actually start the lottery animation` comment through `}, [teamsForLottery, confettiInterval]);`, with:

```jsx
  // Run the lottery instantly, then hand the results to the ball machine to reveal
  const handleStartAnimation = useCallback(async () => {
    if (teamsForLottery.length === 0) return;

    setIsRunning(true);
    try {
      // Results are ordered worst pick first, winner (Pick #1) last
      const results = await runNBALottery(teamsForLottery, null, 0);
      setFullLotteryResults(results);
      setSelections([]);
      setShowResults(false);
      setAnimationStarted(true);
    } catch (err) {
      setError(err.message || 'Lottery failed');
      setIsRunning(false);
    }
  }, [teamsForLottery]);

  // Reveal finished on its own: show the results section behind the popup
  const handleRevealComplete = useCallback(() => {
    setSelections(fullLotteryResults);
    setShowResults(true);
    setIsRunning(false);
  }, [fullLotteryResults]);
```

- [ ] **Step 8: Clean up `handleReset`, delete `handleCancelAnimation`, replace `handleSkipAnimation`**

In `handleReset`, delete the line `setCurrentSelection(null);`.

Delete the whole `handleCancelAnimation` callback, from the `// Handle cancel animation` comment through `}, [confettiInterval]);`. Nothing references it.

Replace the whole `handleSkipAnimation` callback, from the `// Handle skip animation - immediately show results` comment through `}, [teamsForLottery, fullLotteryResults, confettiInterval, runNBALottery]);`, with:

```jsx
  // Skip (or "View Results" after the reveal): close the popup and show every result
  const handleSkipAnimation = useCallback(() => {
    setIsRunning(false);
    setShowAnimation(false);
    setAnimationStarted(false);
    if (fullLotteryResults.length > 0) {
      setSelections(fullLotteryResults);
      setShowResults(true);
    }
  }, [fullLotteryResults]);
```

- [ ] **Step 9: Update the popup `<Dialog>`**

In the `<Dialog open={showAnimation} ...>` block, change `maxHeight: '80vh',` to `maxHeight: '95vh',` (the drum needs more room than the old card row), and replace the `<SelectionAnimation ... />` element with:

```jsx
          <SelectionAnimation
            results={fullLotteryResults}
            animationStarted={animationStarted}
            onStart={handleStartAnimation}
            onComplete={handleRevealComplete}
            onSkip={handleSkipAnimation}
            leagueName={league?.name || 'Fantasy Football'}
          />
```

- [ ] **Step 10: Check that no references to removed code remain**

Run: `grep -n "currentSelection\|setCurrentSelection\|confettiInterval\|skipAnimationRef\|handleCancelAnimation" src/App.jsx`
Expected: no output.

- [ ] **Step 11: Run all tests and the build**

Run: `npm test && npm run build`
Expected: all tests PASS; build succeeds.

- [ ] **Step 12: Commit**

```bash
git add src/components/SelectionAnimation.jsx src/components/SelectionAnimation.test.jsx src/App.jsx
git commit -m "Replace lottery reveal with ball machine animation"
```

---

### Task 9: Visual verification, tuning, and docs

**Files:**
- Create (scratchpad only, never committed): `<scratchpad>/visual-check/run.mjs`
- Modify (only if tuning is needed): `src/utils/drumPhysics.js` constants, `drumRadiusPx` in `src/components/SelectionAnimation.jsx`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: the running dev server at `http://localhost:5173` and the UI labels "Sleeper League ID", "Load Teams", "Run Lottery", "Start Lottery", "View Results".
- Produces: screenshots and a `.webm` recording of the full reveal for the user; updated `CLAUDE.md`.

- [ ] **Step 1: Set up Playwright in the scratchpad**

`<scratchpad>` is the session scratchpad directory. Chrome is installed, so the script uses `channel: 'chrome'` and doesn't need Playwright's bundled browser.

```bash
mkdir -p <scratchpad>/visual-check && cd <scratchpad>/visual-check && npm init -y && npm install playwright
```

If video recording later errors about ffmpeg, run `npx playwright install ffmpeg` in that folder.

- [ ] **Step 2: Write `<scratchpad>/visual-check/run.mjs`**

The script fakes a 12-team Sleeper league (the default "NBA Style (6 Teams)" set puts the bottom 6 in the lottery), serves colored SVG avatars, runs the lottery, and captures each phase with the default timings (2s mix, 1s eject, 2s reveal, 0.75s pause → 5.75s per pick; golden starts at 28.75s; done at 32.25s).

```js
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const COLORS = ['#e53935', '#8e24aa', '#3949ab', '#00897b', '#fdd835', '#fb8c00',
  '#6d4c41', '#546e7a', '#d81b60', '#43a047', '#1e88e5', '#5e35b1'];
const users = COLORS.map((_, i) => ({
  user_id: `u${i + 1}`,
  display_name: `Team ${String.fromCharCode(65 + i)}`,
  // Every 4th team has no avatar, to check the initial-letter fallback
  avatar: i % 4 === 3 ? null : `avatar${i + 1}`,
}));
const rosters = users.map((user, i) => ({
  roster_id: i + 1,
  owner_id: user.user_id,
  settings: { wins: 13 - i, losses: i, ties: 0, fpts: 1500 - i * 20 },
}));
const league = { league_id: '123456789', name: 'Test League', season: '2026', total_rosters: 12, settings: { playoff_teams: 6, type: 0 } };

const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  recordVideo: { dir: OUT, size: { width: 1280, height: 900 } },
});
const page = await context.newPage();

await page.route('https://api.sleeper.app/**', route => {
  const path = new URL(route.request().url()).pathname;
  let body = []; // matchups and drafts
  if (path.endsWith('/users')) body = users;
  else if (path.endsWith('/rosters')) body = rosters;
  else if (path.endsWith('/state/nfl')) body = { week: 1 };
  else if (/\/league\/\d+$/.test(path)) body = league;
  return route.fulfill({ json: body });
});
await page.route('https://sleepercdn.com/**', route => {
  const id = Number(route.request().url().match(/avatar(\d+)/)?.[1] ?? 1);
  const color = COLORS[(id - 1) % COLORS.length];
  return route.fulfill({
    contentType: 'image/svg+xml',
    body: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${color}"/><text x="32" y="42" font-size="28" text-anchor="middle" fill="white" font-family="sans-serif">${id}</text></svg>`,
  });
});

await page.goto('http://localhost:5173/');
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload();

await page.getByLabel('Sleeper League ID').fill('123456789');
await page.getByRole('button', { name: 'Load Teams' }).click();
await page.getByRole('button', { name: 'Run Lottery' }).click();
await page.screenshot({ path: `${OUT}00-start-screen.png` });
await page.getByRole('button', { name: 'Start Lottery' }).click();
const startedAt = Date.now();

const shots = [
  [500, '01-mixing'],
  [2500, '02-ejecting'],
  [3600, '03-revealing'],
  [5300, '04-pausing'],
  [24000, '05-two-teams-left'],
  [29500, '06-golden'],
  [31000, '07-winner-reveal'],
  [33500, '08-complete'],
];
for (const [atMs, name] of shots) {
  await page.waitForTimeout(Math.max(0, startedAt + atMs - Date.now()));
  await page.screenshot({ path: `${OUT}${name}.png` });
}

await page.getByRole('button', { name: 'View Results' }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}09-results.png`, fullPage: true });

// Settings dialog
await page.getByRole('button', { name: 'Settings' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}10-settings.png` });

const video = page.video();
await context.close();
await browser.close();
console.log('Video:', await video.path());
console.log('Screenshots in', OUT);
```

- [ ] **Step 3: Run it against the dev server**

Make sure `npm run dev` is running in the repo (start it in the background if needed), then:

```bash
cd <scratchpad>/visual-check && node run.mjs
```
Expected: prints the video path; `out/` has screenshots 00–10.

- [ ] **Step 4: Review every screenshot (Read tool) against this checklist**

- `01-mixing`: 6 avatar balls spread through the drum (not piled at the bottom); headline "Drawing Pick #6…" (lottery-only mode numbers the 6 lottery picks 1–6); no balls outside the glass.
- `02-ejecting`: one ball at the drum mouth or in the chute; the chute lines up with the drum's right edge.
- `03-revealing`: the opened ball is centered on the drum, its shell halves gone or fading, and the avatar, "Pick #12", and team name are readable; the drawn ball is no longer in the chute.
- `04-pausing`: the remaining balls are settling low in the drum; the draft board shows the first revealed card at the right; headline "Up next: Pick #5".
- `05-two-teams-left`: headline "Two teams left…" with 2 balls tumbling.
- `06-golden`: a single gold-glowing ball rising above the drum.
- `07-winner-reveal`: gold opened ball with "🏆 Pick #1"; confetti visible.
- `08-complete`: "🏆 The draft order is set!", the full board of 6 cards, and a "View Results" button.
- Whole popup: fits a 1280×900 viewport with no scrollbar inside the dialog, and the Skip/View Results button is visible without scrolling.
- `09-results`: the results section lists all 6 picks, as before.
- `10-settings`: the gear dialog shows 3 sliders, "≈ 32s for 6 teams", and "Reset to defaults".

Also scrub through the video to make sure the tumbling looks lively and continuous (no jitter or teleporting) and the eject roll looks smooth.

- [ ] **Step 5: Tune if needed, then re-verify**

If a checklist item fails, adjust only the following, then re-run `npm test` (the physics tests must still pass) and `node run.mjs`:
- Lively tumbling: `JET_LIFT`, `SWIRL`, `JITTER`, `MAX_SPEED` in `src/utils/drumPhysics.js`.
- Settling: `SETTLE_DAMPING`.
- Popup doesn't fit: `drumRadiusPx` (`isSmallScreen ? 80 : 120`) in `RevealStage`, or `getBoardSizes`.

Commit any tuning:

```bash
git add src/utils/drumPhysics.js src/components/SelectionAnimation.jsx
git commit -m "Tune ball machine physics and sizing"
```

- [ ] **Step 6: Update `CLAUDE.md`**

In the "Development Commands" block, add after `npm run preview`:

```bash
npm test         # Run unit tests (Vitest)
```

In "Core Application Flow", replace step 5 with:

```markdown
5. Results are revealed by a ping-pong ball machine, worst pick first, ending with a golden #1 ball
```

In "Key Modules", replace the `src/App.jsx` bullet list item "Animation state machine for lottery reveal sequence" with "Opening the lottery popup and handing it the precomputed results", and add after the `src/constants/index.js` section:

```markdown
**`src/settings/`** - User settings:
- `settingsSchema.js` - Registry of settings (key, label, group, range, default). Add a setting by adding one entry; the dialog and persistence pick it up
- `SettingsContext.jsx` - `SettingsProvider` / `useSettings()`; persists to `localStorage` (`ffLottery.settings`)

**`src/utils/revealTiming.js`** - Reveal phases (mixing → ejecting → revealing → pausing; golden → revealing for #1) and durations

**`src/utils/drumPhysics.js`** - Pure, normalized-coordinate physics for the ball machine drum (gravity, air jet, collisions, eject/rise scripts)

**`src/hooks/useRevealSequence.js`** - Timer-driven walk through the reveal steps
```

In "Component Architecture", replace the `SelectionAnimation` bullet with:

```markdown
- `SelectionAnimation` - Lottery popup: start screen, then the ball machine reveal (headline, opened-ball overlay, draft board, confetti on #1)
- `BallMachine` - Glass drum + chute SVG with one avatar ball per team, animated via `drumPhysics`
- `SettingsDialog` - Gear button + settings dialog generated from the settings registry
```

- [ ] **Step 7: Final full check and commit**

Run: `npm test && npm run build`
Expected: all tests PASS; build succeeds.

```bash
git add CLAUDE.md
git commit -m "Document ball machine reveal and settings in CLAUDE.md"
```

Then send the user the video path and the key screenshots.
