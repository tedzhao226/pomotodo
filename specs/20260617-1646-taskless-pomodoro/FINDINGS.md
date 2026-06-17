# Findings: Taskless Pomodoro + Pin Tasks

## Relevant Files

- `frontend/app.js` — timer, startBlock, credit modal, rehydrate, rowHtml, finishDrag, handleTaskClick.
- `frontend/style.css` — `.row-actions` hover width, row action buttons.
- `frontend/i18n.js` — row action labels.
- `backend/models.py`, `repository.py`, `api.py` — block lifecycle.
- `backend/api.py` `PATCH /api/tasks/order` — pin persists through existing reorder.
- `docs/timer-states.md`, `tests/e2e_timer.js`, `tests/e2e_buckets.js`.

## Discoveries

- Credit modal can take arbitrary task ids + selective pre-check via `{ checkedIds }`.
- `credit_block` repoints null anchor to first credited task.
- Latest migration: `0007_drop_block_archived.py`.
- Task order is server-side per bucket (`sort_order`); `finishDrag` PATCHes full Today
  order. Pin can reuse the same endpoint with `[pinnedId, ...rest]`.
- Drag-reorder is Today-only and disabled under tag filter; pin should follow the
  filter disable rule but must build order from `tasksInBucket()` (full list).

## Drift

- None at plan time. Unrelated dirty worktree (sounds/scripts) — exec should skip.

## Execution Log

_(empty — populated by `/conductor exec`)_
