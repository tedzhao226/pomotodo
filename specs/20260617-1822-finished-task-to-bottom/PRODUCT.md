# Finished Task Sinks to Bottom

## Intent

Today and Backlog task lists are ordered server-side by `Task.sort_order` per bucket
(`backend/repository.py` `list_tasks`, mirrored client-side in `frontend/app.js` `tasksInBucket`).
Marking a task **done** only flips its `status` and styling (`frontend/app.js` toggle handler);
`sort_order` is untouched, so a completed task keeps its place among the active ones.

Make completing a task move it to the **bottom of its bucket**, so active work floats to the top
and finished items collect at the end. Ordering stays server-authoritative; the client mirrors
the move optimistically so the row sinks immediately, before the next sync.

## Behavior

- **Mark done**: when a task's status changes active→done, it re-homes to the bottom of its
  current bucket (`sort_order` = max in bucket + 1). Persisted server-side; survives reload/sync.
- **Immediate UI**: the row visibly drops to the bottom of its list the moment the toggle is
  clicked, before the server responds.
- **Reopen** (done→active): position is **not** restored — the task stays at the bottom. No
  pre-completion slot is remembered.
- **Idempotent**: PATCHing `status=done` on an already-done task does not bump it again.
- **Drag / pin unchanged**: a done task is still freely draggable and pinnable; completion only
  triggers the one-time sink, it does not lock the row.
- **Bucket move unchanged**: moving buckets still re-homes to the bottom of the target bucket; a
  simultaneous done+move re-homes to the bottom of the new bucket exactly once.

## Out of scope

- Restoring the original position when a task is reopened.
- A persistent display rule that always floats done tasks to the bottom (this is a one-time move
  on the done-transition, not a sticky sort).
- Changing how `blocks_done`, tags, notes, or timer selection behave.

## Acceptance

### VAL-SINK-001: Completing a task sinks it below the active tasks

Given Today tasks a, b, c created in order (sort_order 0, 1, 2).
When task a is marked done via `update_task(a, status="done")`.
Then a's `sort_order` becomes 3 and the Today dashboard order is [b, c, a].
Evidence: uv run pytest tests/test_bucket.py::test_completing_task_sinks_to_bottom

### VAL-SINK-002: Reopening a completed task keeps its bottom position

Given task a (sort_order 0) and b (sort_order 1); a is marked done (→ sort_order 2).
When a is reopened via `update_task(a, status="active")`.
Then a's `sort_order` stays 2 (it is not restored to slot 0).
Evidence: uv run pytest tests/test_bucket.py::test_reopening_task_keeps_bottom_position

### VAL-SINK-003: Completing a task visually sinks it immediately

Given the Today list shows a first-created task A above a later task B.
When the user clicks A's status toggle (marking it done).
Then A's row becomes the last `.task-row` in `#today-list` before any server sync completes.
Evidence: tests/e2e_task_crud.js check "sink: done task moves to bottom of Today"

### VAL-SINK-004: No regression

Given the backend and frontend suites.
When they run.
Then `uv run pytest -q` passes, `npm test` passes, and `tests/e2e_task_crud.js` reports
`failedCount: 0`.
Evidence: uv run pytest -q && npm test && cmux browser eval tests/e2e_task_crud.js
