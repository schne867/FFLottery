# Ball Machine Lottery Reveal & Settings Menu — Design

**Date:** 2026-10-05
**Status:** Approved in brainstorming; awaiting spec review

## Goal

Replace the current lottery reveal popup (team cards rolling in from the left) with a
fun, TV-style ping-pong ball machine: avatar balls tumble in a glass drum, one pops out
per pick, and it cracks open to reveal the team. Every pick gets the same full drama,
and the timings are user-adjustable through a new settings menu.

## Decisions (from the user)

- **Style:** NBA-style ping-pong ball machine.
- **Balls:** one ball per team, showing the team's avatar (not scaled to odds).
- **Pacing:** same drama for every pick; timings configurable.
- **Settings menu:** none exists, so build one. First version contains **timings only**,
  but it must be easy to add settings later.
- **Rendering approach:** hand-rolled lightweight physics rendered with DOM/SVG
  (no new runtime dependency).
- **#1 pick:** the "golden ball" finale (see Reveal Sequence).

## Non-goals

- The lottery math does not change. `runNBALottery()` still computes all results up
  front; the ball machine is presentation only and can never affect outcomes.
- No sound effects, confetti toggle, or Points Against toggle in this iteration.
- The pre-start screen (league title + "Start Lottery" over the background image)
  keeps its current look.

## Architecture

### Ownership change

Today `handleStartAnimation` in `src/App.jsx` drives the reveal with chained
`setTimeout`s, pushes `currentSelection` / partial `selections` into a mostly passive
`SelectionAnimation`, and manages the confetti interval.

After this change:

- **`App.jsx`** runs the lottery up front (unchanged), passes the full ordered results
  to the animation, and reacts to two callbacks:
  - `onComplete()` — the reveal finished naturally; show results.
  - `onSkip()` — jump straight to results (existing behavior).
- The timing loop, confetti handling, `confettiInterval`, and per-pick state
  (`currentSelection`, partial `selections` during animation) are removed from App.

### New / changed units

| Unit | Responsibility | Depends on |
|---|---|---|
| `src/utils/drumPhysics.js` | Pure functions: create ball state for N balls in a drum of a given radius; `step(state, dt, options)` advances one frame (gravity, swirl/air-jet force, wall bounce, ball–ball collision, eject motion). Accepts an injectable RNG. Clamps `dt`. No React/DOM. | nothing |
| `src/hooks/useRevealSequence.js` | Given ordered results + timing settings, steps through each pick's phases on a clock and exposes `{ pickIndex, phase, revealed, isComplete }`. Owns and cleans up its timers. Knows nothing about rendering. | settings values |
| `src/components/BallMachine.jsx` | Renders the glass drum + chute (SVG) and one ball per remaining team (absolutely positioned `TeamAvatar`s). Runs the `requestAnimationFrame` loop with `drumPhysics`. Props drive it: which balls remain, whether the jet is on, which ball to eject, golden-ball mode. | `drumPhysics`, `TeamAvatar` |
| `src/components/SelectionAnimation.jsx` (rewritten) | Composes the popup: league title, `BallMachine`, the big "Pick #N → Team" reveal (ball cracking open), the draft-board row of revealed picks, the Skip / View Results button, and confetti on #1. Calls `onComplete` when the sequence finishes. | `useRevealSequence`, `BallMachine`, `useSettings`, `canvas-confetti` |
| `src/settings/settingsSchema.js` | The registry of setting definitions + validation/normalization helpers. | nothing |
| `src/settings/SettingsContext.jsx` | Provider + `useSettings()`; loads/saves `localStorage`. | `settingsSchema` |
| `src/components/SettingsDialog.jsx` | Gear button + MUI Dialog rendering settings from the registry. | `useSettings`, `settingsSchema` |

### Popup layout

Top: league title / current status line ("Drawing Pick #5…", "Two teams left…").
Middle: the drum with the chute exiting to the right; the opened-ball reveal overlays
the center. Bottom: the draft-board row of revealed picks, filling from the last pick
toward #1 (same ordering as today). Skip / View Results button at the bottom center.

## Reveal Sequence

Order: worst pick first, ending at #1 (same as today). Each pick except #1 runs four
phases:

| Phase | Visual | Duration |
|---|---|---|
| `mixing` | Air jet on; all remaining balls tumble hard. Header: "Drawing Pick #N…" | **Mix time** setting |
| `ejecting` | The selected team's ball is pulled to the drum opening and rolls down the chute; others keep bouncing. | Fixed ~1s (not a setting) |
| `revealing` | The ball zooms to center and splits in half revealing "Pick #N" and the team name, then flies into its draft-board slot. | **Reveal hold** setting |
| `pausing` | Jet off; remaining balls settle to the bottom of the drum. | **Pause between picks** setting |

### #2 and #1

- **#2:** normal draw. With two balls left, the header reads "Two teams left…"; the
  ejected ball receives #2.
- **#1 (golden ball):** no mixing phase. The last remaining ball glows gold, rises out
  of the drum, cracks open revealing "🏆 Pick #1" and the team, and confetti fires
  (replacing the current confetti logic in App, same feel: ~6s of bursts).
  Phases: `golden` (~1.5s fixed) → `revealing` (Reveal hold) → complete.

### Skip, completion, cleanup

- Skip is available at any time: stops the sequence and confetti, closes the popup,
  shows results (unchanged behavior from the user's perspective).
- When the sequence completes, the button label changes from "Skip to Results" to
  "View Results" and `onComplete` is called (App shows the results section, as today).
- Unmounting the popup mid-sequence clears all timers, cancels the animation frame,
  and stops confetti.
- The sequence is clock-driven (timers), so backgrounded tabs keep correct timing;
  the physics clamps `dt` on resume so balls do not tunnel through the drum wall.
- Ball and drum sizes scale with team count so 4–16+ balls fit; `TeamAvatar`'s
  initial-letter fallback covers missing/failed avatars.

## Settings System

### Registry (`settingsSchema.js`)

Each setting is one entry: `key`, `label`, `group`, `type` (`'number'`), `min`, `max`,
`step`, `unit`, `default`. Initial entries (group **Lottery Animation**):

| key | Label | Range | Step | Default |
|---|---|---|---|---|
| `mixTimeSeconds` | Mix time | 0.5–10 s | 0.25 | 2 |
| `revealHoldSeconds` | Reveal hold | 0.5–10 s | 0.25 | 2 |
| `pauseBetweenPicksSeconds` | Pause between picks | 0–5 s | 0.25 | 0.75 |

Adding a future setting = adding one entry; the dialog and persistence pick it up
automatically.

### Persistence (`SettingsContext.jsx`)

- Wraps `<App />` in `src/main.jsx`; `useSettings()` returns
  `{ settings, updateSetting(key, value), resetSettings() }`.
- Stored in `localStorage` under a single key (`ffLottery.settings`) as JSON.
- On load, values are normalized against the registry: out-of-range → clamped,
  missing/invalid type → default, unknown keys → dropped, corrupt JSON → all defaults.
- If `localStorage` throws (e.g., some private-browsing modes), use in-memory defaults
  for the session without crashing.

### Dialog (`SettingsDialog.jsx`)

- Gear `IconButton` in the top-right corner of the main panel opens an MUI `Dialog`.
- Settings grouped by `group` heading; each number setting renders as a `Slider` with
  its current value shown (e.g., "2.0s").
- Changes apply and persist immediately (no Save button). "Reset to defaults" at the
  bottom.
- Caption under Lottery Animation estimating total reveal length for the currently
  loaded lottery team count, e.g. "≈ 32s for 6 teams" (non-#1 picks: mix + 1s eject + reveal + pause; #1: 1.5s golden + reveal).
- The gear is underneath the lottery popup, so settings cannot change mid-reveal.

## Testing

Add dev dependencies **Vitest**, **@testing-library/react**, **jsdom** and an
`npm test` script (Vitest reuses the existing Vite config).

- **`drumPhysics`** (seeded RNG): balls remain inside the drum over thousands of steps;
  overlapping balls separate; eject moves only the target ball and it exits via the
  chute; a very large `dt` does not tunnel balls through the wall.
- **Settings registry/persistence:** clamping, invalid/corrupt JSON → defaults, unknown
  keys dropped, new keys default, throwing `localStorage` handled.
- **`useRevealSequence`** (fake timers): phase order and durations follow settings;
  worst→#1 ordering; #1 takes the golden path without `mixing`; skip and unmount clear
  all timers.
- **`SettingsDialog`:** slider change updates and persists; Reset restores defaults.
- **Visual verification (not committed):** a Playwright script in the session
  scratchpad intercepts `api.sleeper.app` with a fake 6-team league, runs the lottery,
  captures screenshots per phase for review, and records a video of the full reveal
  for the user.
