# Findings: Finished Task Sinks to Bottom

## Relevant Files

- `backend/repository.py` — `Repository.update_task` (78-89), `_next_sort_order` (31-35); `list_tasks` orders by `(bucket, sort_order, id)`.
- `backend/service.py` — `update_task` (25-76) forwards `status` into `fields` unchanged.
- `frontend/app.js` — toggle handler (1974-1986), `tasksInBucket` (594-600) sorts by `sort_order`, `finishDrag`/pin write `sort_order` optimistically.
- `tests/test_bucket.py` — `service` fixture (11-23); `test_move_to_backlog_rehomes_at_end` (34-43) re-home pattern; `test_dashboard_orders_today_by_sort_order` (230-235).
- `tests/e2e_task_crud.js` — DOM-driven CRUD harness with `inToday`/`rowId`/`statusOf`/`action` helpers; returns `{passed, failedCount, failed}` and stashes `window.__e2e`.

## Discoveries

- Ordering is server-owned: `list_tasks` sorts `(bucket, sort_order, id)`; the client mirrors `sort_order`, never invents order (comment at app.js:588).
- A re-home pattern already exists for bucket changes (`update_task` sets `sort_order = _next_sort_order(bucket)` before `setattr`) — the done-sink reuses the same mechanism.
- `sort_order` is per-bucket; `_next_sort_order` maxes over `Task.bucket == bucket`, and the `DashboardTask` schema exposes `sort_order` so the client can mirror it.
- The toggle handler already updates state + `renderAll()` optimistically before the awaited PATCH; adding a `sort_order` write there mirrors `finishDrag`/pin.
- A pure client-side display sort was rejected: it would create a second ordering authority conflicting with drag/pin persistence (`finishDrag` persists the visible order). The server-authoritative sink keeps one source of truth.

## Drift

- None at plan time.

## Durable Candidates

- "Task ordering is server-authoritative via `Task.sort_order` per bucket; clients mirror, never invent."

## Execution Log

- 2026-06-17 exec: T1-T5 done. Backend re-home on done-transition in `Repository.update_task`; optimistic `sort_order` mirror in toggle handler. Pytest: `test_completing_task_sinks_to_bottom`, `test_reopening_task_keeps_bottom_position` pass. Full suite: `uv run pytest -q` 45 passed; `npm test` 12 passed. e2e_task_crud 14/14 (`failedCount: 0`), including `sink: done task moves to bottom of Today`.
