# TECH — Skip block into break with 1/3 credit

Frontend-only (`frontend/app.js`). Crediting reuses `completeBlockWithCredit` →
existing `POST /api/blocks/{id}/credit`.

## Changes

1. `completeBlockWithCredit({ nextBreak } = {})` — accept an optional forced break.
   At the end: if `nextBreak` is set, `switchMode(nextBreak, {auto:false})`;
   otherwise keep the current streak-based auto pick (natural completion path).

2. New `skipWorkBlockToBreak(breakMode)`:
   ```
   if mode !== pomodoro or no activeBlock: switchMode(breakMode, {auto:false}); return
   total = activeBlock.durationMin * 60
   elapsedFrac = total>0 ? 1 - remainingSeconds/total : 1
   if elapsedFrac >= 1/3:
     clearTimerInterval(); running=false
     await completeBlockWithCredit({ nextBreak: breakMode })   # credit modal → chosen break
   else:
     if await confirmDiscardPomodoro(): switchMode(breakMode, {auto:false})
   ```

3. Timer-tab handler: if leaving a **running pomodoro** into a break
   (`nextMode` is shortBreak/longBreak), call `skipWorkBlockToBreak(nextMode)`;
   else keep the existing confirm-discard→switch.

4. `skipSession()`: a running pomodoro → `skipWorkBlockToBreak("shortBreak")`;
   a break → `switchMode("pomodoro", {auto:false})` (unchanged).

Units: `remainingSeconds` and `durationMin*60` are both timer-seconds (TIME_SCALE=1);
elapsed fraction is unit-safe. No chime on skip (manual action; the modal is the cue).

## Tests

`tests/e2e/skip.spec.js` (Playwright), driving via page.evaluate where the state
machine requires it:
- ≥1/3: start block on task A, touch A, set `remainingSeconds` to ~1/2 total,
  click Long Break tab, confirm credit modal → `bd(A)` +1, streak +1, mode
  `longBreak`.
- <1/3: start block, set `remainingSeconds` near full, skip (confirm=true) →
  `bd` unchanged, streak unchanged, mode the chosen break.
- ⏭ button ≥1/3 → credits, mode `shortBreak`.

Regression: `npm run e2e` (timer suite + skip), `pytest`, `vitest`.

## Risks

- Must not change natural completion: `completeBlockWithCredit()` with no args is
  byte-for-byte the old behavior (streak-based auto break). Covered by the timer
  suite's VAL-8/10/11.
