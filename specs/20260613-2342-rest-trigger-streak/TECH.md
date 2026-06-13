# Rest Trigger & Consecutive-Block Streak — Tech Spec

Product spec: specs/20260613-2342-rest-trigger-streak/PRODUCT.md

## Problem

`finishBlock` offers rest on any end, and `restDurationMinutes` uses a never-resetting counter, so a
discard both triggers rest and counts toward the long rest. Rest must be gated on natural completion,
and the long rest must require an unbroken run of completed blocks.

## Relevant Code

- `static/app.js:965-997` — `finishBlock(completed)`; increments the counter only on completed but
  offers rest unconditionally.
- `static/app.js:999-1002` — `restDurationMinutes`; long when counter `% longEvery === 0`.
- `static/app.js:38` — `state.completedWorkBlocks` (rename → `state.streakBlocks`).
- `static/app.js:354` — `stopTimer`; work branch calls `finishBlock(false)` (discard path).
- `static/app.js` — `startBlock`'s `startCountdown` onComplete → `finishBlock(true)` (natural path).
- `static/index.html` — timer panel; add `#streak-dots` near `#timer-mode`/`#phase-pill`.
- `static/style.css` — `.streak-dots` + filled/empty dot styles.
- `static/i18n.js` — optional `streak.toLongRest` title (en + zh).

## Current State

`finishBlock` ends the block, does `completedWorkBlocks += 1` when completed, sets phase idle, then
**always** auto-starts rest or shows the prompt. `restDurationMinutes` returns long when
`completedWorkBlocks % longEvery === 0`; the counter never resets, so a discard still advances cadence.

## Implementation

- Rename `state.completedWorkBlocks` → `state.streakBlocks` (init 0; semantics = consecutive completed).
- `finishBlock(completed)` after the successful PATCH + `state.activeBlock = null` + `phase = "idle"`:
  - `completed`: `state.streakBlocks += 1`; set `pendingTaskId`/`pendingDuration`; mode "Block ended";
    `renderTimerButton()`; `renderStreak()`; `await syncNow()`; then
    `state.settings.autoStartRest ? startRest() : (els.continueRestPrompt.hidden = false)`.
  - `!completed`: `state.streakBlocks = 0`; mode "Ready"; `renderTimerButton()`; `renderStreak()`;
    `await syncNow()`; **no rest**.
- `restDurationMinutes`: `state.streakBlocks % longEvery === 0 ? longRest : shortRest` (called only
  after an increment, so streak ≥ 1).
- `renderStreak()`: build `longEvery` dots, fill `streakBlocks % longEvery`; hide the element when
  `longEvery ≤ 1`; call from `finishBlock`, `applySettingsToControls`, and initial load.
- No backend change (completed-only counting already in the repository).

## Edge Cases

- Discard at streak 2 → resets to 0; the next long rest needs `longEvery` fresh completions.
- A completion landing on the `longEvery`th → long rest; the next cycle's dots reset (modulo).
- `longEvery = 1` → every completion is a long rest; the indicator is hidden.
- Reload mid-session resets the streak to 0 (session-scoped, in-memory).
- `autoStartRest` interplay unchanged; only the completed path reaches it.

## Tests

- `node --check static/app.js static/i18n.js`.
- Manual: complete a block → rest offered + a dot fills; discard a block → no rest, Ready, dots reset;
  complete `longEvery` in a row → long rest; discard mid-run → streak resets and the long rest is
  delayed.
