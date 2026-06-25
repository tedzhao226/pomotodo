# Tasks: Live panel refresh

**Goal**: After any mutation (add task, finish pomo, submit), every loaded panel — including History — reflects the new data without a page reload.
**Spec Folder**: /Users/ted/workspace/pomotodo/specs/20260625-1658-live-panel-refresh
**Acceptance**: /Users/ted/workspace/pomotodo/specs/20260625-1658-live-panel-refresh/PRODUCT.md (## Acceptance, VAL-LIVE-001..004)

## Tasks

Execution: serial

Pre-exec audit (2026-06-25): the live-refresh plan (T1/T2) was independently
audited against current `frontend/app.js` and confirmed valid — line numbers
accurate, root cause (history excluded from `syncNow`/`renderAll`) holds, fix
minimal, no regression risk. Scope extended with the user-reported credit bug
(T4/T5); both confirmed by repro and adversarial verification. Host-direct
execution (orchestrator has full investigation context; changes are surgical).

```text
tasks[5]{id,title,depends_on,status,size,type,file,contract_refs,acceptance,write_set,tier,run_path,result}:
  T1,Write live-refresh e2e,,done,M,test,tests/e2e/live-refresh.spec.js,"VAL-LIVE-001,VAL-LIVE-002,VAL-LIVE-003,VAL-LIVE-004","npx playwright test live-refresh",tests/e2e/live-refresh.spec.js,standard,runs/T1/,"001/002/004 green, 003 red (confirms history gap)"
  T2,Refresh history inside syncNow,T1,done,M,impl,frontend/app.js,"VAL-LIVE-001,VAL-LIVE-002,VAL-LIVE-003,VAL-LIVE-004","npx playwright test live-refresh",frontend/app.js,standard,runs/T2/,"refreshHistoryIfLoaded() + fire-and-forget in syncNow; live-refresh 4/4 green"
  T4,Write credit-active e2e (red),T2,done,M,test,tests/e2e/credit-active-task.spec.js,"VAL-CREDIT-ACTIVE-001,VAL-CREDIT-ACTIVE-002,VAL-CREDIT-ACTIVE-003","npx playwright test credit-active-task",tests/e2e/credit-active-task.spec.js,standard,runs/T4/,"001/002b/003 red before fix (bug confirmed)"
  T5,Credit the task active at finish,T4,done,M,impl,frontend/app.js,"VAL-CREDIT-ACTIVE-001,VAL-CREDIT-ACTIVE-002,VAL-CREDIT-ACTIVE-003","npx playwright test credit-active-task","frontend/app.js,docs/timer-states.md",standard,runs/T5/,"owner=active-at-finish + client anchor sync; frontend-only; credit-active 5/5 green; docs updated"
  T3,Validate full suite,T5,done,M,review,,"VAL-LIVE-001,VAL-LIVE-002,VAL-LIVE-003,VAL-LIVE-004,VAL-CREDIT-ACTIVE-001,VAL-CREDIT-ACTIVE-002,VAL-CREDIT-ACTIVE-003","npm run e2e",,review,runs/T3/,"pytest 58, vitest 18, e2e 39 all green; VAL-DEDUP-001 updated to new attribution"
```

`status` values: `pending | in_progress | done | failed | blocked` (canonical lifecycle).
`tier` values: `cheap | standard | deep | review | research`.

### T1: Write live-refresh e2e

Write `tests/e2e/live-refresh.spec.js` per TECH.md ## Tests. Four cases mapping to
VAL-LIVE-001..004. Reuse `tests/e2e/_helpers.js` (`rowAction`, locators by
`data-id`) and the in-page timer pattern from `tests/e2e/_timer-suite.js` (advance
`state.deadline` via `page.evaluate` to complete a pomo instantly; wrap internal
reads in `expect.poll`). Cases:
- 001 add-task → row visible, no navigation.
- 002 finish pomo → mini-card/today-log count increments, no reload.
- 003 **(red before fix)** open History, return to timer, finish+credit a pomo →
  `state.history.pomos` includes it without re-opening History.
- 004 history page preserved across refresh (paginate to page 2, finish pomo,
  `state.history.pomoPage` unchanged).
Run `npx playwright test live-refresh` — expect 001/002/004 green and 003 red
(confirms the gap). Keep the red; T2 turns it green.
Contract refs: VAL-LIVE-001, VAL-LIVE-002, VAL-LIVE-003, VAL-LIVE-004

### T2: Refresh history inside syncNow

In `frontend/app.js`:
1. Add `refreshHistoryIfLoaded()` next to `reloadHistory()` (~line 1346) /
   `refreshStatsIfLoaded()` (1365) — pseudo-code in TECH.md §1: call
   `reloadHistory()` only when `state.history` is truthy. Add the `ponytail:`
   comment noting the extra-fetch ceiling.
2. In `syncNow()` (line 764), call `refreshHistoryIfLoaded()` fire-and-forget
   right after `renderAll()` (line 785). Do NOT await it. Do NOT call
   `openHistory()` (would reset pagination — violates VAL-LIVE-004).
No other files. No backend change. Run `npx playwright test live-refresh` — all
four cases green.
Contract refs: VAL-LIVE-001, VAL-LIVE-002, VAL-LIVE-003, VAL-LIVE-004

### T4: Write credit-active e2e (red before fix)

Write `tests/e2e/credit-active-task.spec.js`. Cases:
- 001 **(red)**: start on A, switch to B mid-block, finish, default Confirm →
  `blocks_done[B]` +1, `blocks_done[A]` +0, one block counted. Then a variant
  where unchecking B and leaving A credits A.
- 002: taskless start, assign a Today task then a Backlog task mid-block, finish →
  the assigned task shows in the modal pre-checked and gets the credit.
- 003: 001 with `autoStartRest:true` → B credited once, break auto-starts.
Reuse `_helpers.js` (`rowAction`, `addTodo`, `expireTimer`, locate by `data-id`).
Run `npx playwright test credit-active-task` — expect 001 red (confirms the bug),
T5 turns it green.
Contract refs: VAL-CREDIT-ACTIVE-001, VAL-CREDIT-ACTIVE-002, VAL-CREDIT-ACTIVE-003

### T5: Credit the task active at finish

In `frontend/app.js`:
1. `completeBlockWithCredit()` — before the `/credit` POST, compute
   `owner = checked.includes(lastActive) ? lastActive : (checked[0] ?? null)` and
   send `task_ids: owner != null ? [owner] : []`. Excluding the stale anchor makes
   the switched-to task win; the note still lists every checked name. One pomo =
   one block = one task. No backend change.
2. `handleTaskClick` `activate` branch — on the first assign to a taskless block,
   set `state.activeBlock.task_id = taskId` (mirror server `set_block_tasks`), so a
   taskless→assign routes to the assigned modal scenario and a Backlog task is no
   longer hidden.
3. Update `docs/timer-states.md` (and a superseding note in
   `specs/20260619-0630-pomo-finish-credit`) so the credit flow reads "the pomo
   credits the task active at finish", not "stays on the assigned/anchor task".
Run `npx playwright test credit-active-task` — all green.
Contract refs: VAL-CREDIT-ACTIVE-001, VAL-CREDIT-ACTIVE-002, VAL-CREDIT-ACTIVE-003

### T3: Validate full suite

Fresh-eyes check against PRODUCT.md ## Acceptance for BOTH scopes. Confirm the
live-refresh diff is 1 helper + 1 call site (no per-callsite edits, no backend),
`reloadHistory()` not `openHistory()` on the sync path (VAL-LIVE-004); confirm the
credit diff is frontend-only, preserves one-pomo-one-block, and credits the active
task. Run `npm run e2e`, `uv run pytest -q`, `npm test` — all green, no regression
in timer / task-crud / history-delete / block-sync / credit-registers /
credit-finish-bugfixes. Remove the scratch `_repro-credit.spec.js`. Report
PASS/FAIL with evidence.
Contract refs: VAL-LIVE-001..004, VAL-CREDIT-ACTIVE-001..003
