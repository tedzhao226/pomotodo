# Tasks: Fix e2e_timer failures + sound-off

**Goal**: Make `tests/e2e_timer.js` deterministically green via test-only state
hygiene; run the suite with sound off.
**Spec Folder**: /Users/ted/workspace/pomotodo/specs/20260617-1928-fix-e2e-timer-failures
**Acceptance**: PRODUCT.md ## Acceptance (VAL-FIX-001..006)

## Tasks

Execution: serial

```text
tasks[6]{id,title,depends_on,status,size,type,file,contract_refs,acceptance,write_set,backend,run_path,result}:
  T0,StatsBlock.task_id nullable (root cause),,done,S,impl,backend/schemas.py,"VAL-FIX-001,VAL-FIX-002,VAL-FIX-003,VAL-FIX-004",pytest -q,backend/schemas.py,claude,runs/T0/,Fixed: task_id int|None. /api/stats no longer 500s on taskless blocks; syncNow stops freezing.
  T0b,Backend regression test for stats+taskless,T0,done,S,test,tests/test_taskless_block.py,VAL-FIX-006,pytest -q tests/test_taskless_block.py,tests/test_taskless_block.py,claude,runs/T0b/,5 passed incl. test_stats_response_accepts_taskless_block.
  T1,startTaskless resets to pomodoro tab,,done,S,impl,tests/e2e_timer.js,"VAL-FIX-002,VAL-FIX-004",e2e failedCount 0,tests/e2e_timer.js,claude,runs/T1/,Pomodoro-tab click + settle prepended; taskless starts a real block after a prior completion.
  T2,VAL8 relative counts + pinned streak,T1,done,S,impl,tests/e2e_timer.js,VAL-FIX-003,e2e failedCount 0,tests/e2e_timer.js,claude,runs/T2/,Streak pinned to 0; bd deltas asserted; also added syncNow settle to confirmCredit/abortEsc.
  T3,setSettings sound off + assert,T2,done,S,impl,tests/e2e_timer.js,VAL-FIX-005,e2e failedCount 0,"tests/e2e_timer.js",claude,runs/T3/,soundEnabled/tickEnabled false in setSettings; VAL-SOUND-001 added.
  V1,Verify e2e x2 + pytest + vitest,"T0,T0b,T1,T2,T3",done,M,review,,"VAL-FIX-001,VAL-FIX-006",pytest -q && npm test,,claude,runs/V1/,e2e 90/0 twice; pytest 47; vitest 12. All green.
```

Note: a speculative `syncNow` out-of-order guard (T-trial) was applied then
**reverted** — it was not the root cause; the diff stays minimal.

### T0: StatsBlock.task_id nullable — ROOT CAUSE
`StatsBlock.task_id: int` → `int | None`. `/api/stats` 500'd on taskless blocks,
freezing `syncNow`. One line; unblocks the whole cascade.

### T0b: Backend regression test
`test_stats_response_accepts_taskless_block`: complete a taskless block, build
`StatsResponse(**service.get_stats())` — must not raise.

### T1: startTaskless resets to pomodoro tab
Prepend pomodoro-tab click + `sleep(150)` so it starts a real pomodoro block even
when a prior completion left break mode.

### T2: VAL8 relative counts + pinned streak
Pin `state.streakBlocks = 0`; assert `bd` deltas (C +1, A +0, B +0). Also added a
trailing `syncNow()` to `confirmCredit`/`abortEsc` so buffer-dependent reads are
fresh.

### T3: setSettings sound off + assert
`soundEnabled: false` + `tickEnabled: false`; `VAL-SOUND-001` after first
`setSettings()`.

### V1: Verify
e2e twice on fresh DB (`failedCount: 0` both — got 90/0); `pytest -q` (47+5);
`npm test` (12).
```
