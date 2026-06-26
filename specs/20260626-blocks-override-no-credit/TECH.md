# Approach

Drop `blocks_override` rather than patch the latch. `blocks_done` becomes a pure
projection of completed blocks (`get_task_block_stats`), so there is no second
source of truth to fall out of sync.

## Changes (commit 1f04813)

- `backend/models.py` — remove the `blocks_override` column.
- `backend/repository.py` — `_task_to_dict` drops the field; `get_all_tasks_with_stats`
  returns the computed count directly.
- `backend/service.py` — `update_task` drops the `blocks_done` param; `get_dashboard`
  returns `task_stats["blocks_done"]` (no `override ?? computed`).
- `backend/schemas.py` / `backend/api.py` — drop `blocks_done` from `UpdateTaskRequest`
  and the update call.
- `frontend/app.js` — remove the editor "done" input and its save path.
- `frontend/i18n.js` — remove the now-dead `editor.done` keys (en + zh).
- `alembic/versions/0011_drop_blocks_override.py` — drop the column (also clears every
  stuck override; entrypoint runs `alembic upgrade head` on boot).

Two e2e flakes surfaced while diagnosing were also fixed: `credit-active-task`
(poll the credited count instead of a one-shot read that races the post-credit
`syncNow`) and `live-refresh` (assert `pomosTotal`, not page-capped `pomos.length`).

## Tests

- `tests/e2e/edit-keeps-credit.spec.js` — VAL-EDIT-CREDIT-001, the regression:
  edit a task, finish a pomo, assert it credits (fails on the pre-fix latch).
- `tests/test_*.py` — existing backend coverage of `blocks_done` as the computed count.

## Verification

```sh
npx playwright test edit-keeps-credit   # VAL-EDIT-CREDIT-001
npm run e2e                             # full browser suite (39+ green)
uv run pytest -q                        # backend (58 passed)
grep -rn blocks_override backend frontend   # nothing
```
