# Live panel refresh — main page reflects new data without a page reload

## Intent

When the user adds a task, finishes a pomo, or otherwise submits new data, the
main page must reflect it immediately in the relevant panel — no manual F5 / page
reload, and no navigating away and back to coax it to appear.

Scope (decided with user): **same tab only**. No cross-tab / cross-device live
sync (no SSE, no WebSocket). The mechanism is the existing in-page refresh path
(`syncNow`), kept as simple as possible.

## Context from investigation

An audit of every mutation handler in `frontend/app.js` shows most of this
**already works**:

- Task add (line 1871), pin (2067), move (2100), delete (2167), toggle (2187),
  save (2224) — each does an optimistic re-render then `syncNow()` or
  `scheduleSync()`. The task-add race (periodic sync clobbering the new task)
  was fixed 2 hours ago in commit `2f2220e` via a generation token.
- Finish pomo — `endBlock` (~1556) and `completeBlockWithCredit` (~1634) both
  call `syncNow()`, which re-renders the dashboard, today-log, mini-cards, and
  stats.

The **one structural gap**: `syncNow()` (line 764) fetches only `/api/dashboard`
+ `/api/stats`, and `renderAll()` (line 744) renders only dashboard / today-log /
mini-cards / stats. **History is excluded.** History data (`/api/history`) is
fetched only by `openHistory()` (tab open — resets to page 0) and `reloadHistory()`
(in-tab delete, lines 1991/2005). So a finished pomo does not reach the History
panel through the normal refresh path.

This spec closes that gap and locks the already-working paths with regression
tests so the "new data appears without refresh" contract is verified, not assumed.

## Acceptance

### VAL-LIVE-001: New task appears without a page reload
Given the main view is loaded and a task is added via the add-task form.
When the POST `/api/tasks` succeeds and `syncNow()` resolves.
Then the new task row is visible in its bucket without a page reload, and is not
later removed by a trailing periodic sync (the generation guard holds).
Evidence: `tests/e2e/live-refresh.spec.js` — add task, assert row visible via
`expect(locator)`, assert no navigation.

### VAL-LIVE-002: Finished pomo appears in today-log / mini-cards / stats without a reload
Given a pomo is running.
When it completes and is credited.
Then the today-log, mini-cards, and stats counts reflect the finished pomo
without a page reload.
Evidence: `tests/e2e/live-refresh.spec.js` — finish a pomo via the in-page timer
machinery (advance `state.deadline`), assert counts updated via `expect.poll`.

### VAL-LIVE-003: Finished pomo appears in the History panel without navigating away
Given the History panel has been opened at least once this session (so
`state.history` is loaded) and a pomo is then finished.
When `syncNow()` runs after the pomo completes.
Then `state.history.pomos` includes the finished pomo without a page reload and
without re-opening the History tab.
Evidence: `tests/e2e/live-refresh.spec.js` — open History, return to timer,
finish a pomo, assert via `expect.poll(page.evaluate(...))` that the new pomo is
in `state.history.pomos`.

### VAL-LIVE-004: Live history refresh preserves the current page
Given the user is on History page N (N > 0) and a pomo finishes.
When `syncNow()` refreshes history.
Then the History view stays on page N (uses `reloadHistory()`, not
`openHistory()` which resets to page 0).
Evidence: covered by code inspection — the refresh helper calls `reloadHistory()`;
assert in review that no `openHistory()` call is added to the sync path.

---

## Added scope: credit lands on the task you ended on (bug fix)

User-reported bug, confirmed by repro then locked by
`tests/e2e/credit-active-task.spec.js` (VAL-CREDIT-ACTIVE-001, red before the fix):
when a pomo is started on task A and the user **assigns/switches to task B
mid-block**, finishing and confirming the credit modal with the default
(both-checked) selection credits the **start anchor A** — task B (the one you
switched to) gets **no** pomo. The user only sees the symptom as "I added the new
task to the running block mid-session and the credit didn't land on it"; with
auto-start on, the next pomo auto-seeds on the *old* task, so it felt tied to
auto-break.

Root cause: one pomo = one block = one task (`block.task_id`, intentional, tested).
The backend keeps the existing anchor whenever it is still in the checked list
(`repository.py:305`); the modal pre-checks every touched task, so the anchor
always wins over the switched-to task. Compounded by a client/server desync —
`state.activeBlock.task_id` is never updated after a mid-block assign, so a
taskless-start + assign mis-routes to the "unassigned" modal scenario and a
**Backlog** task assigned mid-block is filtered out of the modal entirely.

Decided with user: the finished pomo credits the **task active at finish** (the
last task you assigned/switched to). Other checked tasks enrich the note only —
one pomo is still one block. No separate auto-break defect exists (the credit
modal is a real blocking overlay; `credit-registers.spec.js` already proves
finish-credit works with `autoStartRest` on).

### VAL-CREDIT-ACTIVE-001: A mid-block switch credits the task you ended on
Given a pomo started on task A, then task B is assigned/switched-to mid-block.
When it finishes and the credit modal is confirmed with the default selection.
Then `blocks_done` for **B** increases by exactly 1 and **A** does not; exactly
one block is counted. Unchecking B and leaving A checked instead credits A.
Evidence: `tests/e2e/credit-active-task.spec.js`.

### VAL-CREDIT-ACTIVE-002: Taskless start + mid-block assign credits the assigned task
Given a pomo started with no task, then a task T (Today **or** Backlog) is assigned
mid-block.
When it finishes.
Then the credit modal shows T pre-checked and confirming credits T (`blocks_done`
+1), with no page reload. A Backlog T is no longer hidden from the modal.
Evidence: `tests/e2e/credit-active-task.spec.js`.

### VAL-CREDIT-ACTIVE-003: Works the same with auto-start breaks on
Given `autoStartRest` is enabled and a pomo is switched A→B mid-block.
When it finishes and credit is confirmed.
Then B is credited exactly once and the break auto-starts — no double-count, no
lost credit.
Evidence: `tests/e2e/credit-active-task.spec.js`.
