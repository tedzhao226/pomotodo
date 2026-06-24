# Tasks: Restart resets the timer to idle ("no state")

**Goal**: ↺ resets work/rest to idle (abort the block, clear the break), confirm only past
1/3; only ▶ starts a new timer. Docs updated.
**Spec Folder**: /Users/ted/workspace/pomotodo/specs/20260622-1150-restart-reset-to-idle
**Acceptance**: /Users/ted/workspace/pomotodo/specs/20260622-1150-restart-reset-to-idle/PRODUCT.md (## Acceptance, VAL-RESTART-*)

## Tasks

Execution: serial

```text
tasks[4]{id,title,depends_on,status,size,type,file,contract_refs,acceptance,write_set,tier,run_path,result}:
  T1,Tests: rewrite suite VAL-6 + new restart.spec.js,,pending,M,test,tests/e2e/restart.spec.js,"VAL-RESTART-001,VAL-RESTART-002,VAL-RESTART-003,VAL-RESTART-004,VAL-RESTART-005",npx playwright test restart,"tests/e2e/restart.spec.js,tests/e2e/_timer-suite.js",standard,runs/T1/,
  T2,Impl restartTimer reset-to-idle + enable,T1,pending,M,impl,frontend/app.js,"VAL-RESTART-001,VAL-RESTART-002,VAL-RESTART-003,VAL-RESTART-004,VAL-RESTART-005","npx playwright test restart timer",frontend/app.js,standard,runs/T2/,
  T3,Update docs/timer-states.md,T2,pending,S,impl,docs/timer-states.md,VAL-RESTART-006,"grep -n restart docs/timer-states.md",docs/timer-states.md,cheap,runs/T3/,
  T4,Full verify,T3,pending,M,review,,"VAL-RESTART-001,VAL-RESTART-002,VAL-RESTART-003,VAL-RESTART-004,VAL-RESTART-005,VAL-RESTART-006","npx playwright test restart timer break-resume skip && npm test && uv run pytest -q",,review,runs/T4/,
```

### T1: Tests — rewrite suite VAL-6 + new restart.spec.js

Per TECH.md ## Tests. (a) `tests/e2e/_timer-suite.js`: replace VAL-6 (~279-291) so restart
from a running <1/3 work block asserts discard-to-idle (`activeBlock` null, mode pomodoro,
running false, full remaining, touched empty, streak 0), then re-establish an open running
block so VAL-8 (immediately after) still reaches its credit modal — keep VAL-8 assertions
unchanged. (b) New `tests/e2e/restart.spec.js` (model `skip.spec.js`/`break-resume.spec.js`,
`_helpers.js`; advance via `state.deadline`; `stubConfirm`) covering VAL-RESTART-001..005.
Tests fail until T2 (expected). (VAL-RESTART-001..005)

### T2: Impl restartTimer reset-to-idle + enable

`frontend/app.js`: rewrite `restartTimer()` to the reset-to-idle logic with the 1/3 confirm
gate (TECH.md ## Changes pseudo-code) — work discards via `finishBlock(false)` then
`switchMode("pomodoro",{auto:false})`; rest (or block-less) silently `switchMode(mode,
{auto:false})`. Update the comment. Change `renderTimer` enable line to
`els.restartBtn.disabled = !timerIsActive();`. Drop the start chime. T1 must go green.
(VAL-RESTART-001..005)

### T3: Update docs/timer-states.md

Rewrite the restart description (VAL-RESTART-006): state-machine edge (~68) Running/Paused
→ Idle (abort) + a rest restart→idle edge; Notes (~81-83); the "Restart re-runs..." line
(~121-122); counting invariant (~181); add a Changelog (~192) entry. Restart now belongs to
the **Abort** family (drops touched, no credit); confirm only ≥1/3. Remove stale "same
block / touched kept" restart claims. (VAL-RESTART-006)

### T4: Full verify

Run the verification command set. All green = done. (all VAL-RESTART-*)
