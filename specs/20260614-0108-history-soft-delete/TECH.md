# History Persistence & History Page — Tech Spec

Product spec: specs/20260614-0108-history-soft-delete/PRODUCT.md

## Problem

`delete_task`/`delete_completed_tasks` hard-delete the task, and `Task.blocks` cascades
`delete-orphan`, so deleting a todo erases its pomo history. History must survive a delete, and an
all-time history view must be browsable without the 90-day stats window.

## Relevant Code

- `app/models.py:20-43` — `Task`; add `archived: bool` (default false). Keep the `blocks`/`tags`
  cascade (only fires on a real hard delete, which we stop calling).
- `app/repository.py:111-128` — `delete_task` / `delete_completed_tasks`; switch to `archived=True`.
- `app/repository.py:55-61` — `list_tasks`; exclude archived. `:70-74` — `task_ids_in_bucket` exclude.
- `app/repository.py:219-243` — `get_completed_blocks(since)`; make `since` optional (all-time).
- `app/repository.py:180-200` — `get_task_block_stats`; reused for per-todo `blocks_done`.
- `app/repository.py:252-258` — `count_tasks`; unchanged (counts all → history persists).
- `app/service.py:90-110` — `delete_task` / `clear_completed_tasks` (archive); `:152` `get_stats`
  pattern; add `get_history()`.
- `app/schemas.py` — add `HistoryResponse` + `HistoryTodo`.
- `app/api.py:100-106` — delete route (now archives); `:141-145` — add `GET /api/history`.
- `static/index.html:19-23` — nav; `:115-166` — views; `:87-112` — mini-cards.
- `static/app.js` — `showView`/`els.views`, `renderStats` (mirror), `localDayKey`/`hourMinute`/
  `formatDateTime` + today-log grouping (reuse), delete/clear confirm strings.
- `static/i18n.js` — `nav.history`, `history.*`, status labels (en + zh).

## Current State

Deletes call `session.delete(task)`, cascading blocks+tags. `list_tasks` returns all tasks.
`get_completed_blocks` requires a `since` (90-day stats). Nav is Main/Statistics/Settings; the mini
"Pomo/Todo History" cards link to Statistics.

## Implementation

- **Migration** (Alembic `0003`): `ALTER TABLE tasks ADD COLUMN archived BOOLEAN NOT NULL DEFAULT
  false`, plus an index supporting the not-archived list filter.
- **Soft delete:** `delete_task(id)` sets `archived=True` (no row/block deletion);
  `delete_completed_tasks()` sets `archived=True` where `status="done"`. `list_tasks` and
  `task_ids_in_bucket` add `Task.archived.is_(False)`.
- **History data:** `get_completed_blocks(since=None)` returns all-time when `since` is None;
  `get_all_tasks_with_stats()` returns every task (incl. archived) merged with `get_task_block_stats`
  for `blocks_done`. `service.get_history()` → `{pomos: [...all completed blocks...], todos: [...]}`.
  `api`: `GET /api/history` → `HistoryResponse`.
- **Frontend:** add a `history` view + nav tab; `renderHistory()` fetches `/api/history` when the tab
  opens (mirrors `renderStats`), renders the day-grouped pomos timeline (reuse the today-log grouping)
  and the todos list with Active/Done/Deleted status chips. Repoint the two mini-cards to
  `data-view="history"`. Update the delete/clear confirm copy + i18n.

## Edge Cases

- Archived task still owns its blocks (FK intact); `get_running_block`/stats joins still resolve.
- Deleting an *active* (not done) todo → archived; History shows it as **Deleted**.
- Reorder/move/start exclude archived; a block running when its task is archived still closes out.
- `all_time_todos` / `done_todos` keep counting archived (history persists).
- No un-delete (non-goal); archived is terminal in the UI.

## Tests

- `uv run pytest`: delete → task absent from `get_dashboard` but `all_time_pomos` unchanged and the
  task appears in `get_history().todos` (archived); clear-completed archives done tasks (history kept);
  `get_history` returns all-time pomos + every todo; reorder ignores archived.
- `node --check static/app.js static/i18n.js`; browser-harness: delete a todo that has pomos → the
  Pomo/Todo History counts don't drop and the todo shows as **Deleted** on the History tab.
