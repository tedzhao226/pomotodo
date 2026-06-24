# Approach

Frontend + docs. The new restart is `stopTimer()` generalized with a 1/3 confirm gate —
every primitive already exists (`finishBlock(false)` abort, `switchMode(mode,{auto:false})`
idle reset, `syncBreak()` break clear, the `timer.confirmDiscard` string, the 1/3 fraction
from `skipWorkBlockToBreak`). No backend, schema, or i18n change.

## Changes

1. **`frontend/app.js` — rewrite `restartTimer()` (currently ~1731-1740)** to reset to idle
   instead of re-running:

   ```
   // Restart resets the timer to idle ("no state") for the current mode — it does
   // NOT re-run. A running/paused work block is discarded (abort: no credit, streak
   // reset); a rest is cleared. Start then begins a fresh timer. Confirm only past 1/3.
   async function restartTimer() {
     if (!timerIsActive()) return;                         // nothing to reset (button is disabled anyway)
     if (state.timerMode === "pomodoro" && state.activeBlock) {
       const total = state.activeBlock.durationMin * 60;
       const frac = total > 0 ? 1 - state.remainingSeconds / total : 1;
       if (frac >= 1 / 3 && !window.confirm(t("timer.confirmDiscard"))) return;
       clearTimerInterval();
       state.running = false;
       const discarded = await finishBlock(false);         // PATCH completed:false, streak 0
       if (discarded) await switchMode("pomodoro", { auto: false });
       return;
     }
     // rest (or work with no open block): silent reset to idle, same mode.
     clearTimerInterval();
     state.running = false;
     await switchMode(state.timerMode, { auto: false });    // running=false -> renderTimer -> syncBreak DELETEs break
   }
   ```
   Drop the old `primeAudio()` / `playChime("start")` — nothing starts on a reset.

2. **`frontend/app.js` — `renderTimer()` enable line (~352)**:
   `els.restartBtn.disabled = !timerIsActive();`  (was `!state.activeBlock`).

The button stays bound to `restartTimer` (~1839). `stopTimer()` / Esc are unchanged.

## Why this is safe / correct

- `finishBlock(false)` already ends the block server-first and only clears local state on
  success, resetting `streakBlocks = 0` — so a failed PATCH leaves the timer untouched
  (`discarded` false → no switchMode).
- `switchMode` sets `remainingSeconds = timerDurationSeconds()` (full) and `running = false`
  → idle. For rest, `renderTimer → syncBreak` sees `running === false` and `DELETE`s the
  server break, so reload shows idle (FINDINGS: syncBreak keys break-active off
  `mode≠pomodoro && running && deadline`).
- ▶ from idle: work → `startPomodoro` → `startBlock` (new block id); rest → `startCountdown`.

## Tests

1. **`tests/e2e/_timer-suite.js` — rewrite VAL-6 (~279-291).** The old check asserted
   same-block / full-clock / touched-preserved. Replace with: restart from a running work
   block (touched present, <1/3 elapsed so it is silent) → `activeBlock === null`,
   `timerMode === "pomodoro"`, `running === false`, `remainingSeconds` full,
   `touchedTaskIds.size === 0`, `streakBlocks === 0`. **VAL-8 immediately follows and needs
   an open running block** — after the restart, re-establish one (select a task + Start +
   rebuild the touched set VAL-8 expects) before VAL-8's `expire()`. Keep VAL-8's
   assertions intact.

2. **New `tests/e2e/restart.spec.js`** (model on `skip.spec.js` / `break-resume.spec.js`,
   helpers from `_helpers.js`; advance the clock by poking `state.deadline`, stub confirm
   via `stubConfirm`). Cover:
   - VAL-RESTART-001: start a short break, restart → idle same mode; assert
     `getState` running false / mode shortBreak / full remaining; reload (`page.reload` +
     `gotoApp`) shows idle (no running break).
   - VAL-RESTART-002: start a work block, touch a task, keep >1/3 remaining, restart →
     `activeBlock` null, mode pomodoro, touched empty, streak 0; confirm NOT called.
   - VAL-RESTART-003: start a work block, advance past 1/3 (`state.deadline`), restart with
     `stubConfirm(false)` → unchanged (block still open); then `stubConfirm(true)` → idle.
   - VAL-RESTART-004: after a restart, click Start → new `activeBlock.id` (work).
   - VAL-RESTART-005: assert `#restart-btn` disabled when idle, enabled while running and
     while paused.

3. **`docs/timer-states.md`** — update (VAL-RESTART-006): the state-machine `Running -->
   Running: Restart` self-loop becomes `Running/Paused --> Idle: Restart (abort)`; rest
   gains a restart→idle edge; the Notes (~81-83), the "Restart re-runs..." line (~121-122),
   the counting invariant (~181), and the Changelog (~192) describe reset-to-idle/abort
   with the 1/3-confirm rule. Fold restart into the existing **Abort** family (drops touched,
   credits nobody).

## Verification commands

```sh
npx playwright test restart            # new behavior
npx playwright test timer              # rewritten VAL-6 + VAL-8 still green (state machine)
npx playwright test break-resume skip  # adjacent abort/break specs regression
npm test                               # frontend unit, sanity
uv run pytest -q                       # backend untouched, sanity
```
