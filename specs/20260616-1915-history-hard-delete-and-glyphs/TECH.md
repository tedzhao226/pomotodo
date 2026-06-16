# History Permanent Delete + Glyph Refresh — Tech Spec

Product spec: specs/20260616-1915-history-hard-delete-and-glyphs/PRODUCT.md

## Decision: reverse the block soft-delete, go hard

Master's `Block.archived` (migration `0005`, merged 2026-06-16) is the *only* mechanism behind the
current history pomo delete, and `archive_block` is its only writer (`backend/repository.py:123-129`;
called only by `service.delete_block`, `backend/service.py:93-95`). The credit de-dup that shipped in
the same commit does **not** touch `Block.archived` (`repository.credit_block` re-points `task_id`, no
archive). So switching pomo delete from soft→hard makes the whole `Block.archived` apparatus dead.

On a fresh pre-launch DB the clean change is to remove it rather than leave a dead column plus
always-true `Block.archived.is_(False)` filters:

- Drop `blocks.archived` (new Alembic revision `0007`, down-revision `0006_break_state`).
- Remove `Block.archived` from `backend/models.py`.
- Remove the `Block.archived.is_(False)` filter from every block query that has it:
  `get_completed_blocks_page`, `count_completed_blocks`, `get_task_block_stats`,
  `get_tag_summaries`, `get_completed_blocks` (the dedup spec lists these five).
- Delete `archive_block` (repo), `delete_block` (service), `DELETE /api/blocks/{id}` (api), and
  `tests/test_block_delete.py` (it tests the removed soft behavior).

`Task.archived` (todo-list soft delete) is **kept** — VAL-HD-005.

## New permanent-delete path

- `backend/repository.py`:
  - `hard_delete_block(block_id) -> bool`: `block = session.get(Block, id)`; if None return False;
    `session.delete(block)`; flush; return True.
  - `hard_delete_task(task_id) -> bool`: `task = self._get(task_id)` (no archived filter, so it works
    on archived todos too); if None return False; `session.delete(task)` (cascades blocks + tags via
    the existing `cascade="all, delete-orphan"` relationships); flush; return True.
- `backend/service.py`:
  - `hard_delete_block(block_id)`: raise `NotFoundError` if repo returns False.
  - `hard_delete_todo(task_id)`: raise `NotFoundError` if repo returns False.
- `backend/api.py`:
  - `DELETE /history/pomos/{block_id}` → `service.hard_delete_block`, 204, 404 on NotFound.
  - `DELETE /history/todos/{task_id}` → `service.hard_delete_todo`, 204, 404 on NotFound.
  - (Place near `GET /history`, after `get_history`.)

## Frontend

`frontend/app.js`:

- History click handler (currently ~`els.views.history` listener, `app.js:1720-1747`):
  - `delete-pomo` → `window.confirm(t("confirm.deletePomo"))` guard, then
    `api(`/api/history/pomos/${id}`, { method: "DELETE" })`, then `reloadHistory()` +
    `refreshStatsIfLoaded()`.
  - `delete-todo` → `window.confirm(t("confirm.deleteTodo"))` guard, then
    `api(`/api/history/todos/${id}`, { method: "DELETE" })`, then `reloadHistory()` +
    `refreshStatsIfLoaded()`.
  - On cancel, return without a request.
- Glyphs:
  - `rowHtml` (`app.js:528-558`): note button `🗒`→`≡`; `moveIcon` `↥/↧`→`↑/↓`; delete button `🗑`→`✕`.
    (`✓` done, `✎` edit unchanged.)
  - History render (`renderHistory`, ~`app.js:1266-1349`): pomo + todo delete buttons `🗑`→`✕`.
- Ensure `openHistory` / `api` / `syncNow` / `state.history.{pomos,todos,pomosTotal,todosTotal}` /
  `t` remain reachable as window globals for the e2e harness (they already are on master).

`frontend/i18n.js`: add `confirm.deletePomo` / `confirm.deleteTodo` (en + zh). Existing
`history.deletePomo` / `history.deleteTodo` (button titles) stay.

```
en: confirm.deletePomo "Permanently delete this pomo? This cannot be undone."
    confirm.deleteTodo "Permanently delete this todo and its pomos? This cannot be undone."
zh: confirm.deletePomo "永久删除这个番茄？此操作不可撤销。"
    confirm.deleteTodo "永久删除这个待办及其番茄？此操作不可撤销。"
```

`frontend/style.css`: glyph swap is text-only; existing `.row-delete/.row-edit/.row-move/.row-note`
rules already size mono glyphs. **CSS change required (VAL-VIS-001):** the shared `.row-delete`
base is `opacity: 0`, revealed only by `.task-row:hover` — history rows are `.log-item` /
`.history-todo`, so without a rule the delete `✕` is invisible. Add a history override making them
faintly always-visible (`opacity: 0.35`) and full on `.log-item:hover` / `.history-todo:hover`.

## Tests

- `tests/test_history_delete.py` (new): VAL-HD-001/002/003. Pattern: in-memory sqlite Service,
  `_credited_task` helper (create_task_from_raw → start_block → credit_block), assert
  `hard_delete_block` drops the block + pomos_total, `hard_delete_todo` cascades blocks+tags and
  drops both totals, both raise `NotFoundError` for id 999.
- `tests/test_block_delete.py`: **delete** (tests removed soft behavior).
- `tests/e2e_history_delete.js` (new): VAL-HD-004/ICON-002. Seed one todo + two credited pomos via
  API, `openHistory()`, stub `window.confirm`; assert cancel is a no-op, confirmed pomo delete
  removes one row + decrements `state.history.pomosTotal`, confirmed todo delete removes the todo +
  cascades its pomos; assert the delete control glyph is `✕`. Stash report on `window.__e2e`.
- `tests/e2e_task_crud.js`: extend with a VAL-ICON-001 assertion that a rendered row's controls show
  `≡ ↑|↓ ✎ ✕` and no `🗒`/`🗑`.

## Verification commands

```sh
uv run pytest -q
node --check frontend/app.js && node --check frontend/i18n.js
# fresh e2e server (see CLAUDE.md), then cmux browser eval e2e_history_delete.js + e2e_task_crud.js
```

## Edge cases

- Hard-deleting a todo that is already `archived` (soft-deleted from the list) must still work —
  `hard_delete_task` uses `session.get`, not the archived-filtered list.
- Deleting the last pomo of a day removes its day group on next `reloadHistory`.
- A running (un-ended) block is not in completed-pomo history, so it is not a delete target.
- Migration `0007` down-revision must be `0006_break_state` (current head).
