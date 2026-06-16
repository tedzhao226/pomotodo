# TASKS — History Permanent Delete + Glyph Refresh

Execution: serial

```toon
[task]{id,title,depends_on,status,size,type,file,contract_refs,acceptance,write_set,backend,run_path,result}
T1,"Backend: remove block soft-delete, add hard delete + migration 0007",,done,L,impl,backend,"VAL-HD-001,VAL-HD-002,VAL-HD-003,VAL-HD-005","uv run pytest -q","backend/models.py,backend/repository.py,backend/service.py,backend/api.py,alembic/versions/0007_drop_block_archived.py,tests/test_block_delete.py",claude,runs/T1/,"done: dropped Block.archived +5 filters; hard_delete added; migration 0007 up/down verified"
T2,"Backend tests: tests/test_history_delete.py","T1",done,M,test,tests,"VAL-HD-001,VAL-HD-002,VAL-HD-003","uv run pytest -q tests/test_history_delete.py","tests/test_history_delete.py",claude,runs/T2/,"done: 3 tests pass"
T3,"Frontend: confirm + /api/history delete endpoints + mono glyphs + i18n","T1",done,M,impl,frontend,"VAL-HD-004,VAL-ICON-001,VAL-ICON-002","node --check frontend/app.js && node --check frontend/i18n.js","frontend/app.js,frontend/i18n.js,frontend/style.css",claude,runs/T3/,"done: confirm+history endpoints; glyphs ≡/↑↓/✕; i18n en+zh; no CSS change"
T4,"Frontend e2e: e2e_history_delete.js + glyph asserts in e2e_task_crud.js","T2,T3",done,M,test,tests,"VAL-HD-004,VAL-ICON-001,VAL-ICON-002","cmux browser eval e2e_history_delete.js + e2e_task_crud.js against fresh server","tests/e2e_history_delete.js,tests/e2e_task_crud.js",claude,runs/T4/,"done: history_delete 14/14; task_crud 13/13; e2e_timer 79/79 (assertion updated)"
T5,"Review + verify against ## Acceptance","T1,T2,T3,T4",done,M,review,.,"VAL-HD-001,VAL-HD-002,VAL-HD-003,VAL-HD-004,VAL-HD-005,VAL-ICON-001,VAL-ICON-002","full pytest + node --check + both e2e green",,claude,runs/T5/,"done: 41 pytest + node --check green; pre-existing master failures (buckets reorder, i18n_notes selector) flagged"
```

## T1 — Backend: remove block soft-delete, add hard delete + migration 0007

Reverse the `Block.archived` soft-delete and replace with permanent delete.

- `backend/models.py`: remove the `Block.archived` column.
- `alembic/versions/0007_drop_block_archived.py`: new revision, down-revision `0006_break_state`;
  `upgrade` drops `blocks.archived`, `downgrade` re-adds it (`Boolean, server_default false, not null`).
- `backend/repository.py`:
  - delete `archive_block`.
  - remove `Block.archived.is_(False)` from `get_completed_blocks_page`, `count_completed_blocks`,
    `get_task_block_stats`, `get_tag_summaries`, `get_completed_blocks`.
  - add `hard_delete_block(block_id)`: get Block; None→False; `session.delete`; flush; True.
  - add `hard_delete_task(task_id)`: `self._get(task_id)`; None→False; `session.delete` (cascades
    blocks+tags); flush; True.
- `backend/service.py`: delete `delete_block`; add `hard_delete_block` / `hard_delete_todo`, each
  raising `NotFoundError` when the repo returns False.
- `backend/api.py`: delete the `DELETE /blocks/{block_id}` route; add `DELETE /history/pomos/{block_id}`
  and `DELETE /history/todos/{task_id}` (204, 404 on NotFound), placed after `get_history`.
- delete `tests/test_block_delete.py`.
- Run the migration on a scratch DB to confirm up/down both work.

Acceptance: `uv run pytest -q` green (after T2 lands the new tests; T1 alone should leave no
references to the removed symbols — grep `archive_block`/`delete_block`/`/api/blocks/.*DELETE`).

## T2 — Backend tests

`tests/test_history_delete.py`: in-memory sqlite `Service(Repository(db))` fixture; `_credited_task`
helper = `create_task_from_raw(raw)` → `start_block(id,25)` → `credit_block(block_id,[id],"done")`.

- `test_delete_pomo_removes_block` (VAL-HD-001): seed 1 credited task; `hard_delete_block(pomos[0].id)`;
  assert `pomos_total` − 1 and `count(Block)==0`.
- `test_delete_todo_cascades` (VAL-HD-002): seed; `hard_delete_todo(task.id)`; assert `todos_total==0`,
  `pomos_total==0`, `count(Block)==0`, `count(TaskTag)==0`.
- `test_delete_missing_404` (VAL-HD-003): `hard_delete_block(999)` and `hard_delete_todo(999)` each
  raise `NotFoundError`.

Acceptance: `uv run pytest -q tests/test_history_delete.py` green.

## T3 — Frontend

Per TECH.md: confirm-guarded `delete-pomo`/`delete-todo` handlers calling
`/api/history/pomos/{id}` and `/api/history/todos/{id}`, then `reloadHistory()` +
`refreshStatsIfLoaded()`. Glyph swaps in `rowHtml` (`🗒→≡`, `↥/↧→↑/↓`, `🗑→✕`) and in `renderHistory`
(pomo+todo delete `🗑→✕`). Add `confirm.deletePomo`/`confirm.deleteTodo` (en+zh) to `frontend/i18n.js`.
CSS only if a glyph renders visibly off.

Acceptance: `node --check frontend/app.js && node --check frontend/i18n.js`.

## T4 — Frontend e2e

`tests/e2e_history_delete.js` (VAL-HD-004, VAL-ICON-002): follow the `tests/e2e_timer.js` pattern —
seed one todo + two credited pomos via `api`, `await openHistory()`, stub `window.confirm`; assert
cancel no-op, confirmed pomo delete removes one row + decrements `state.history.pomosTotal`, confirmed
todo delete removes the todo + cascades its pomos; assert the row's delete control text is `✕`. Report
`{passed,failedCount,failed}` and stash on `window.__e2e`.

Extend `tests/e2e_task_crud.js` (VAL-ICON-001): after a row renders, assert its controls contain
`≡ ↑|↓ ✎ ✕` and neither `🗒` nor `🗑`.

Acceptance: both scripts return `{"passed":N,"failedCount":0}` against a fresh server (CLAUDE.md).

## T5 — Review + verify

Fresh-eyed pass over the diff against `## Acceptance` (all VAL-*). Confirm: no dangling references to
removed soft-delete symbols; `Task.archived`/`test_bucket.py` untouched and green; migration 0007
up/down clean; full `uv run pytest`, `node --check`, both e2e green. Write `HANDOFF.md`.
