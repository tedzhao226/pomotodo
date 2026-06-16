# FINDINGS — Pomo de-dup + soft-delete

## Research journal

### Credit + blocks (read 2026-06-16, branch feat/pomo-dedup-soft-delete off master @ 404ddca)

- `backend/repository.py:200` `credit_block(block_id, task_ids, note)`: closes the
  anchor block, `completed = block.task_id in task_ids`, `note = note`, then adds a
  fresh completed `Block(note=note)` for every other credited task. This is the
  source of duplicate pomos: one real session → N completed blocks.
- A `Block` row is the unit counted everywhere. All of these filter only
  `Block.completed.is_(True)` (no archived concept yet):
  - `get_completed_blocks_page` / `count_completed_blocks` → History pomos + count + `all_time_pomos`.
  - `get_task_block_stats` → per-task `blocks_done`, total minutes.
  - `get_tag_summaries` → tag stats.
  - `get_completed_blocks(since)` → stats trend window.
- `_block_to_dict` exposes `id`, `task_id`, `task_name`, `duration_min`,
  `started_at`, `ended_at`, `note` — so the frontend already has `block.id` to
  target a delete.
- Extra credited rows are written with `started_at == ended_at == now` (0-length),
  which is the `16:56 16:56` phantom in the screenshot.

### Soft-delete state

- Tasks: `Task.archived` (migration `0003_task_archived`). `delete_task` →
  `archived = True` (keeps row + blocks). Active task lists filter
  `Task.archived.is_(False)`; History todos (`get_all_tasks_with_stats`) include
  archived (shown struck-through). **Archived tasks' blocks still count in stats**
  (stats don't filter by task.archived) — so VAL-TDEL-001 requires adding that filter.
- `Block` has no `archived` column / delete endpoint / UI. Latest migration is
  `0004_block_note`; next is `0005_block_archived` (mirror `0003`).
- Frontend History (`frontend/app.js` `renderHistory`, ~1199 pomos / ~1241 todos)
  is read-only — no delete controls. The active todo list has a delete button
  (`data-action="delete"`, line 544) calling `DELETE /api/tasks/{id}`.

### Decisions (user, 2026-06-16)

- **De-dup model: one pomo per timer session.** Credit stops creating extra block
  rows; the single session block carries the combined note. Secondary credited
  tasks do NOT each gain a block of progress. Pomo count = real sessions.
- **Soft-delete in History for pomos + todos, excluded from stats.** Soft-deleted
  pomos (and the blocks of deleted todos) drop from History lists AND from stats
  totals; rows are kept (recoverable).
- Scope: backend + web frontend. TUI delete UI deferred (TUI inherits backend).

### Conventions

- Migration mirrors `0004_block_note` (revision/down_revision strings, server_default).
- Delete endpoint mirrors `DELETE /api/tasks/{id}` (204, NotFoundError → 404).
- Tests reuse `tests/conftest.py` `app_transport` (StaticPool + commit-on-yield)
  and the `Service(Repository(session))` fixture in `tests/test_block_record.py`.
- This branch is master-based; the TUI test suite (`tests/test_tui_*`) lives on
  `feat/tui` and is NOT present here, so the full suite is backend + e2e only.

## Execution Log

(append-only; exec writes here)

- 2026-06-16 — exec start (dag). Branch feat/pomo-dedup-soft-delete off master. Native mirror #15-#20 = T1-T6. Impl acceptance (T1/T2) validated when paired tests land (T3), per the deferred-acceptance pattern.
- 2026-06-16 — T1 in_progress → dispatch codex.
- 2026-06-16 — T1 done. credit_block: -21/+5; no extra rows; anchor re-pointed to task_ids[0] when its own task uncredited; returns 1. Smoke covered VAL-DEDUP-001/002/003.
- 2026-06-16 — T2 in_progress → dispatch codex (same files repository.py/service.py, so serial after T1).
- 2026-06-16 — T2 CONFLICT (blocked, drift). codex implemented soft-delete: migration 0005, Block.archived, archive_block, delete_block, DELETE /api/blocks/{id}, and excluded BOTH archived blocks AND archived-task blocks from history+stats. Orchestrator also added `id: int` to schemas.StatsBlock (was stripped over HTTP; frontend needs it to target a delete — added schemas.py to T2 write_set). API smoke OK (id over HTTP, DELETE 204/404, stats drop). BUT excluding archived-TASK blocks broke 5 existing test_bucket tests: test_delete_archives_and_keeps_history / test_clear_completed_archives_keeps_history assert that deleting/clearing a TODO KEEPS its pomos in stats+history (all_time_pomos & blocks_done stay). That is intentional shipped behavior, contradicting VAL-TDEL-001 (delete-todo excludes pomos from stats). DRIFT → pause, ask user. Pomo soft-delete (archived BLOCK exclusion) is safe and does NOT break those tests; only the archived-TASK exclusion does. Pending decision: keep existing (revert task-archived filter, drop VAL-TDEL-001) vs reverse (exclude, update the 2 tests).
- 2026-06-16 — DECISION: keep existing (deleted todo keeps its pomos). Dispatched T2 correction: removed Task.archived exclusion + the Task joins added for it from all 5 queries; kept Block.archived. keeps_history now passes (2). VAL-TDEL-001 reframed in PRODUCT.md. T2 done.
- 2026-06-16 — Post-T1/T2 suite: 3 failures, ALL old multi-block credit semantics broken by the one-pomo dedup: test_block_record::test_credit_note_on_every_credited_pomo + test_bucket::{test_credit_block_credits_each_checked_task,test_credit_block_dedupes_task_ids}. These are T3's to update (added tests/test_bucket.py to T3 write_set). NOT a regression — expected debt from the intended dedup.
- 2026-06-16 — T3 (tests) + T4 (frontend) in_progress → dispatch codex/cursor in parallel (disjoint write-sets: tests vs frontend).
- 2026-06-16 — T3 done. Full suite 40 passed; selectors all pass; old multi-credit tests rewritten to one-pomo. T4 done. Frontend History delete: delete-pomo/delete-todo buttons + handler (DELETE /api/blocks|tasks → reloadHistory + refreshStatsIfLoaded), i18n en+zh. T1/T2 pytest acceptance back-filled green.
- 2026-06-16 — T5 in_progress → orchestrator (claude) runs e2e on host via cmux (update VAL-REC to one-pomo, add VAL-DEL).
- 2026-06-16 — T5 done. e2e_timer.js: VAL-REC-005/006 rewritten to one-pomo (recPomos.length===1, attributed to A, no separate B pomo); VAL-DEL added (create+delete a pomo via #history-pomos delete-pomo button → leaves history; delete a todo via delete-todo button → archived). cmux browser e2e: 80 passed, failedCount 0. VAL-UI-001, VAL-REG-001, VAL-DEDUP-001 confirmed end-to-end in the browser.
- 2026-06-16 — T6 in_progress → dispatch codex (fresh review vs PRODUCT acceptance + full suite).
- 2026-06-16 — T6 done. Fresh codex GATE PASS: all 8 VAL PASS with file:line evidence; migration chain 0004->0005 correct; missing-id delete raises NotFoundError; no bugs. Orchestrator confirmed `uv run pytest -q` 40 passed. EXEC COMPLETE (6/6).
- 2026-06-16 — VERIFY PASS. Deterministic: all 8 VAL acceptance commands pass; `uv run pytest -q` 40 passed; cmux e2e 80 passed failedCount 0. Changed files all in scope (backend api/models/repository/schemas/service + migration 0005, frontend app.js/i18n.js, tests). Ledger consistent (6/6 done, evidence present). Fresh-eyes layer = T6 codex GATE PASS. HANDOFF.md written. SPEC COMPLETE.
