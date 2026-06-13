# Rest Single-Button & Select Color — Tech Spec

Product spec: specs/20260613-2254-rest-single-button/PRODUCT.md

## Problem

The timer's hold-to-stop and Escape paths are gated on `state.activeBlock`, which is null during rest,
so rest can't reuse them. Rest also has its own prompt/skip button and no visual differentiation. The
selects have no `accent-color`, so Chromium paints the option highlight in an aggressive red.

## Relevant Code

- `static/app.js:257` — `renderTimerButton`; add phase-aware hint + panel accent class.
- `static/app.js:294` — `startCountdown`; `:308`/`:318` — `pauseTimer`/`resumeTimer` (used by both phases).
- `static/app.js:329` — `stopTimer`; branch on phase.
- `static/app.js:916` — `startBlock` (work); `:932` — `finishBlock` (offer/auto rest); `:960` —
  `restDurationMinutes`; `:965` — `startRest` (rest).
- `static/app.js:1042-1075` — hold (`pointerdown`) + `Escape` wiring; gate on phase.
- `static/app.js:1091-1108` — continue/rest/skip handlers.
- `static/app.js:114-125` — `playChime`; gate on `soundEnabled`.
- `static/app.js:5-11` — `DEFAULT_SETTINGS`.
- `static/index.html` — timer panel + `#rest-prompt`/`#skip-rest-btn` (remove); settings form.
- `static/style.css:284` — `select` (`accent-color`); `:412` `.timer-display`; `:421` `.timer-mode`;
  `:415` `#timer-btn`; `:495` `.prompt`.
- `static/i18n.js` — new keys (en + zh).

## Current State

`startRest` runs `startCountdown("Resting")` with `activeBlock` null plus a `#rest-prompt`/Skip-rest
button. Hold/Esc are gated on `activeBlock`, so they do nothing during rest. Work and rest panels look
identical. `playChime` always plays. Selects have no `accent-color`.

## Implementation

- Add `state.phase = "idle" | "work" | "rest"` (replaces implicit rest detection). `startBlock`→`work`,
  `startRest`→`rest`; both return to `idle` on end/skip; keep `state.mode` (running/paused) for pause.
- `stopTimer`: `phase==="work"` → `finishBlock(false)` (discard, uncounted); `phase==="rest"` → clear
  interval, `phase="idle"`, mode idle, Ready.
- Hold `pointerdown` + `Escape`: gate on `state.phase !== "idle"` (so rest is skippable).
- `finishBlock`: after ending a work block, if `settings.autoStartRest` call `startRest()`, else show
  `#continue-rest-prompt`. Remove `#rest-prompt` + skip-rest handler; rest state lives in `#timer-mode`
  + the hint.
- Visual: set `phase-work`/`phase-rest` on `#timer-panel` from `startCountdown`/`renderTimerButton`;
  CSS tints `.timer-display`/`.timer-mode` and shows a tomato/green phase pill; hint key is
  `timer.holdStop` (work) vs `timer.holdSkip` (rest).
- Settings: add `autoStartRest:false`, `soundEnabled:true` to `DEFAULT_SETTINGS`; two checkboxes in the
  settings form; wire `applySettingsToControls` + submit; gate `playChime` on `soundEnabled`.
- Select color: `select { accent-color: var(--green); }` and `input[type="checkbox"] { accent-color:
  var(--green); }`.

## Edge Cases

- Pause rest then long-press/Esc → skip works (phase-gated, not `activeBlock`).
- Switching language mid-rest re-renders text only; the countdown keeps running.
- Toggling `autoStartRest` mid-session applies on the next block end.
- `soundEnabled` off silences both chimes.
- Resume-on-reload applies only to work blocks (rest isn't a server block).
- Work long-press still discards (incomplete, uncounted).

## Tests

- `node --check static/app.js static/i18n.js`.
- Manual: work start→pause→resume→hold/Esc discard (task count unchanged); enable auto-rest → rest
  auto-starts; during rest pause/resume + hold/Esc skip → Ready; phase pill/color switch tomato↔green;
  sound toggle silences the chime; open a dropdown → highlight is green.
