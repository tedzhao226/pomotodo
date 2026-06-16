# History Permanent Delete + Item Glyph Refresh — Product Spec

Links: none.

## Summary

Two changes on the web client:

1. **History permanent delete** — on the History page the user can permanently (hard) delete a
   single pomo entry or a single todo entry, each behind a confirm dialog. This *replaces* the
   current soft (archive) pomo delete; deleting a todo from history removes the task and cascades
   to its pomos and tags.
2. **Item glyph refresh** — the todo-row action controls (and the history delete control) use one
   consistent monochrome line-glyph set instead of today's mismatched mix (mono glyphs alongside
   colour emoji `🗒`/`🗑`).

## Problem

- History accumulates forever. The only pomo delete today is *soft* (`Block.archived`), so a wrong,
  test, or private entry is hidden but never actually removed; there is no real purge. The user
  wants deliberate, confirmed, permanent deletion of both pomo and todo entries.
- The todo row mixes monochrome glyphs (`✓ ✎ ↥ ↧`) with colour emoji (`🗒 🗑`), so the action
  cluster renders inconsistently across platforms and looks unpolished.

## Goals

- Permanently delete one pomo (a completed block) from the Pomos history — the row is gone for good.
- Permanently delete one todo (a task) from the Todos history, cascading its pomo blocks and tags.
- Every permanent delete is confirmed first; cancel performs no change.
- After a delete, the History page and the home stats / mini-cards reflect the new totals.
- The existing **todo-list** delete stays soft (archives, keeps history) — unchanged.
- The todo-row action controls and history delete control share one consistent monochrome glyph set.

## Non-goals

- Undo / restore of permanently deleted entries.
- Bulk / range delete, date-filtered purge, or export.
- Changing the soft `DELETE /api/tasks/{id}` semantics used by the todo list.
- An icon-font or SVG icon system (explicitly chosen against — plain unicode glyphs only).
- TUI changes (the `feat/tui` branch stays unmerged).

## User Experience

### History permanent delete
Each pomo row and each non-archived… (todo) row on the History page carries a delete control. Clicking
it opens a native confirm dialog. On confirm the entry is removed via a dedicated permanent-delete
endpoint, the History page reloads, and the home stats (totals, mini-cards, today log) refresh. On
cancel nothing happens. Deleting a todo permanently also removes that todo's pomo blocks — they
disappear from the Pomos history and stop counting toward totals.

### Glyph refresh
The todo row's controls render as a single monochrome line-glyph family:

| Action | Old | New |
|--------|-----|-----|
| mark done / reopen | `✓` | `✓` (unchanged) |
| show note | `🗒` | `≡` |
| move to today | `↥` | `↑` |
| move to backlog | `↧` | `↓` |
| edit | `✎` | `✎` (unchanged) |
| delete (todo list) | `🗑` | `✕` |
| delete (history pomo/todo) | `🗑` | `✕` |

No colour emoji remain in the row/history action clusters.

## Acceptance

### VAL-HD-001: Permanently delete a pomo removes its block
Given a completed block exists in pomo history.
When `service.hard_delete_block(block_id)` runs (via `DELETE /api/history/pomos/{block_id}`).
Then the block row is gone from the DB and `count_completed_blocks()` drops by one.
Evidence: uv run pytest tests/test_history_delete.py::test_delete_pomo_removes_block

### VAL-HD-002: Permanently delete a todo cascades to its blocks and tags
Given a task with completed blocks and tags.
When `service.hard_delete_todo(task_id)` runs (via `DELETE /api/history/todos/{task_id}`).
Then the task row, its blocks, and its tags are all gone; history pomos_total and todos_total drop.
Evidence: uv run pytest tests/test_history_delete.py::test_delete_todo_cascades

### VAL-HD-003: Unknown id raises NotFound
Given no entry with the id.
When either permanent delete runs with an unknown id.
Then a NotFoundError is raised (HTTP 404).
Evidence: uv run pytest tests/test_history_delete.py::test_delete_missing_404

### VAL-HD-004: History UI delete is confirmed, removes the row, refreshes totals
Given the History page with a seeded todo that has two pomos.
When the user cancels the confirm, nothing changes; when the user confirms, the targeted pomo/todo
row leaves the DOM and the section total decrements; deleting the todo cascades away its pomos.
Evidence: tests/e2e_history_delete.js → {"passed":N,"failedCount":0}

### VAL-HD-005: Todo-list soft delete unchanged
Given a todo with completed pomos.
When `DELETE /api/tasks/{id}` runs (the todo-list delete).
Then the task is archived (not removed) and its pomos remain in history and stats.
Evidence: uv run pytest tests/test_bucket.py (existing *_keeps_history coverage stays green)

### VAL-ICON-001: Todo row uses the consistent monochrome glyph set
Given a rendered todo row.
Then its note/move/edit/delete controls render the glyphs `≡ ↑|↓ ✎ ✕` (no `🗒`/`🗑`).
Evidence: tests/e2e_task_crud.js asserts the control glyphs; `node --check frontend/app.js`

### VAL-ICON-002: History delete control uses the same delete glyph
Given a rendered History pomo row and todo row.
Then each delete control renders `✕` (no `🗑`).
Evidence: tests/e2e_history_delete.js asserts the delete-control glyph

### VAL-VIS-001: History delete controls are visible at rest
Given a rendered History pomo row and todo row.
Then each `✕` delete control is visible without hovering (computed opacity > 0), brightening on
row hover. (The shared `.row-delete` base is `opacity: 0`; history rows override to a faint
always-on state so the affordance is discoverable, incl. on touch.)
Evidence: tests/e2e_history_delete.js asserts the resting opacity of both delete controls > 0
