# Findings

## Current restart (frontend/app.js)

- `restartTimer()` (~1731): pomodoro-only, requires `state.activeBlock`; re-runs the same
  block from full via `startCountdown(...)` immediately. Bound at ~1839.
- `renderTimer` (~352): `els.restartBtn.disabled = !state.activeBlock` — work-only enable.

## Primitives the new behavior reuses

- `finishBlock(false)` (~1466): ends block server-first (`PATCH /api/blocks/{id}
  {completed:false}`), only clears local state on success; sets `streakBlocks = 0`; keeps
  the block's task selected. Returns false on PATCH failure (timer left intact). This is the
  existing **abort** path (also used by `confirmDiscardPomodoro` / under-1/3 skip).
- `switchMode(mode, {auto:false})` (~1649): clears interval, `running=false`,
  `remainingSeconds = timerDurationSeconds()` (full), renders. The canonical idle reset.
- `syncBreak()` (~299, called in `renderTimer`): break is active server-side only when
  `mode≠pomodoro && running && deadline`. A rest reset (`running=false`) → `desired="none"`
  → `DELETE /api/break`. So resetting a rest to idle auto-clears the server break; reload
  shows idle. No explicit break call needed.
- `stopTimer()` (~434, Esc): already does work→`finishBlock(false)`→`switchMode("pomodoro")`,
  rest→`switchMode(mode)`. The new restart == this, plus a 1/3 confirm gate. **Esc stays
  unchanged** (silent, any-progress) — only the restart button changes.
- 1/3 threshold + `t("timer.confirmDiscard")`: from `skipWorkBlockToBreak` (~1701) /
  `confirmDiscardPomodoro` (~1686).

## ▶ Start from idle (timerBtn handler ~1823)

idle work → `startPomodoro` → `startBlock` (new server block id); idle rest →
`startCountdown(remaining, advanceAfterComplete)`. So "only Start begins a new timer" already
holds once restart leaves the panel idle.

## Test + doc surfaces

- `tests/e2e/_timer-suite.js` VAL-6 (~279-291) asserts the OLD restart (same block / full
  clock / touched kept) and runs **mid-sequence**: VAL-8 right after needs an open running
  block to `expire()` into the credit modal. Rewriting VAL-6 to discard means re-arming a
  block before VAL-8.
- `docs/timer-states.md` describes restart in 4 spots: state-machine edge (~68), Notes
  (~81-83), "Restart re-runs..." (~121-122), counting invariant (~181), changelog (~192).

## Decisions

- Restart = reset to idle (abort), work + rest. Discards the work block (no credit, streak
  0); clears the rest break. **Confirm only ≥1/3 elapsed**; <1/3 and rest are silent
  (user choice). Start begins a new timer.
- Esc/`stopTimer` left as-is (scope discipline).

## Execution Log

- 2026-06-22 11:50 — plan written (PRODUCT/TECH/FINDINGS/TASKS). 4 serial tasks.
