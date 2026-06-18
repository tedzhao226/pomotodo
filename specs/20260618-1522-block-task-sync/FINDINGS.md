# FINDINGS — block task sync

## Audit: state-sync across events (frontend/app.js)

Persisted (api/syncNow/scheduleSync): task add/edit/delete/move/reorder/pin/
toggle/clear-completed; block start (`POST /blocks`), taskless first-assign
(`POST /blocks/{id}/assign`), complete/abort (`PATCH /blocks`), credit (`POST
/credit`); break start/clear (`PUT`/`DELETE /break`).

Client-only (gaps):
- **Mid-block switch** — app.js:1975 `touchedTaskIds.add(taskId)` + `activeTaskId
  = taskId`; only the *first* taskless assign persists (`assigning` branch). A
  switch when a task is already active does not sync.
- **Chip-remove** — app.js:1761 `touchedTaskIds.delete(id)`; no sync.
- **Active task after a switch** — server `block.task_id` stays the anchor.
- Pause/resume — no server pause; rehydrate (app.js:765) computes elapsed from
  `started_at` assuming continuous run. Out of scope.

Root: `Block` has one `task_id` (model.py:69); `get_running_block` returns only
`task_id` + `task_name`. Rehydrate sets `touchedTaskIds = {rb.task_id}` — losing
the rest.

## Fix

Server-side touched set (`block_touches` join table) + active task; client PUTs
`{active_task_id, touched_task_ids}` on every mid-block change; rehydrate restores
both. Consolidate `/assign` → `PUT /blocks/{id}/tasks`.

## Execution Log

- 2026-06-18 15:22 — audit + plan. Backend migration + endpoint + frontend wiring.
  Tasks B1/B2/F1/T1/V1 pending.
- 2026-06-18 15:40 — exec. **replanned**: persisting the active task into
  block.task_id on every switch broke the dedup design (timer VAL-DEDUP-001:
  the pomo must attribute to the *anchor* A, not the switched-to B). Corrected:
  set_block_tasks keeps the anchor (sets task_id only when null = first taskless
  assign) and only persists the touched set; rehydrate restores touched + active
  = anchor. Also fixed a spec-isolation bug: block-sync leaked an open server
  block that rehydrated into later specs (credit modal intercepted clicks) →
  added an afterEach that ends the block.
- 2026-06-18 15:45 — V1 done. Full e2e 13 passed (timer/VAL-DEDUP green,
  block-sync green, 28s normal), pytest 52, vitest 12. Bug fixed: mid-block
  touched set persists (PUT /blocks/{id}/tasks) + restores on rehydrate; anchor
  preserved for dedup.
