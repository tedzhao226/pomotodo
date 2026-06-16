# HANDOFF — History Permanent Delete + Glyph Refresh

Branch: `feat/history-hard-delete-glyphs` (off `master` @ `c59b2c0`). Not committed yet.

## What shipped

1. **History permanent (hard) delete** — replaces the 1-day-old `Block.archived` soft pomo delete.
   - Backend: dropped `Block.archived` (migration `0007`, removed the 5 query filters), removed
     `archive_block`/`service.delete_block`/`DELETE /api/blocks/{id}` + `tests/test_block_delete.py`.
     Added `hard_delete_block` / `hard_delete_task` (cascades blocks+tags) and confirmed endpoints
     `DELETE /api/history/pomos/{block_id}` and `DELETE /api/history/todos/{task_id}` (404 on unknown).
   - Frontend: History pomo/todo delete now `window.confirm`-guarded, hits the new endpoints, then
     `reloadHistory()` + `refreshStatsIfLoaded()`. The todo delete button now also shows for archived
     todos (so soft-deleted entries can be purged for good).
   - `Task.archived` (todo-list soft delete) is unchanged — VAL-HD-005 green.
2. **Glyph refresh** — row + history controls now use one monochrome line-glyph family:
   `≡` note, `↑/↓` move, `✕` delete (rows + history); `✓` done, `✎` edit unchanged. No more `🗒`/`🗑`.
   No CSS change needed (24×24 boxes with explicit font-size).

## Verification

- `uv run pytest -q` → **41 passed** (incl. new `tests/test_history_delete.py`, 3 tests).
- `node --check` on app.js / i18n.js / all e2e → OK.
- Migration `0007` up→drop, down→re-add verified on a scratch DB; head = `0007_drop_block_archived`.
- Browser e2e (each on a fresh DB, cmux harness):
  - `e2e_history_delete.js` → **14/14** (VAL-HD-004, VAL-ICON-002).
  - `e2e_task_crud.js` → **13/13** (added VAL-ICON-001 glyph asserts).
  - `e2e_timer.js` → **79/79** (its old soft-todo-delete assertion updated to expect hard delete).
- No dangling references to removed soft-delete symbols.

## Acceptance status

VAL-HD-001/002/003 (pytest), VAL-HD-004 + VAL-ICON-002 (e2e_history_delete), VAL-HD-005 (test_bucket
green), VAL-ICON-001 (e2e_task_crud) — all **met**.

## Pre-existing failures (NOT from this work — reproduced on clean master)

- `e2e_buckets.js` → "reorder: order persisted after sync" fails (DOM flips, server order reverts
  after sync). Confirmed identical on `master` via stash.
- `e2e_i18n_notes.js` → script errors on a stale selector `[data-view=main]`; the main nav button
  uses `data-view="pomotodo"`. Static mismatch, view markup untouched by this work.

Both are separate bugs worth a follow-up ticket; left out of scope here.

## Next step

Commit on the feature branch and open a PR when the user asks.
