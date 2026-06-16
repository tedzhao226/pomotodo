# FINDINGS — History Permanent Delete + Glyph Refresh

## Research journal

- A stale branch `feat/history-hard-delete` (cut from `404ddca`, before master's `dc0fefc` stats +
  `c59b2c0` dedup/break-sync) already designed this feature, but merging it would revert
  `block.archived`/dedup/break-sync. Rebuilt fresh from master instead. Branch left in place,
  unmerged; its spec/tests were used only as reference and removed from the tree.
- `feat/tui` stays unmerged by request (experimental).
- **No branch contains an icon change.** The "better icons" the user remembered do not exist on any
  branch (`git diff master..<each>` over `app.js/style.css/index.html` shows only chart-SVG hits).
  Icon work is therefore new; user chose plain monochrome unicode glyphs (not SVG, not icon-font).

## Key code facts (master)

- `Block.archived` written only by `repository.archive_block` (`repository.py:123`), called only by
  `service.delete_block` (`service.py:93`). Dedup (`credit_block`) does not use it. → soft pomo
  delete is self-contained and safe to remove.
- `Block.archived.is_(False)` filters live in the five block queries named in the dedup TECH:
  `get_completed_blocks_page`, `count_completed_blocks`, `get_task_block_stats`,
  `get_tag_summaries`, `get_completed_blocks`.
- Task↔Block / Task↔TaskTag relationships are `cascade="all, delete-orphan"` (`models.py`), so
  `session.delete(task)` cascades to blocks + tags for the hard todo delete.
- `_get(task_id)` is a plain `session.get(Task, id)` (no archived filter) — works on archived todos.
- History rows already expose ids: `StatsBlock.id` (added by dedup) and `HistoryTodo.id`; rows render
  `data-action="delete-pomo|delete-todo"` + `data-id` with a `🗑` button and a no-confirm handler
  (`app.js:1720-1747`). Need: confirm + repoint to `/api/history/...` + glyph swap.
- `Task.archived` (todo-list soft delete) and `test_bucket.py::*_keeps_history` must stay green.
- Migration head is `0006_break_state`; new revision is `0007`.
- Row glyphs in `rowHtml` (`app.js:528-558`): `✓`(done) `🗒`(note) `↥/↧`(move) `✎`(edit) `🗑`(delete).

## Execution Log

- 2026-06-16 plan: spec authored from master; decision = remove `Block.archived` soft-delete, add
  hard delete via `/api/history/pomos|todos/{id}`, refresh row+history glyphs to mono unicode.
- 2026-06-16 exec: T1-T5 done on branch `feat/history-hard-delete-glyphs`. 41 pytest, all node
  --check, e2e_history_delete 14/14, e2e_task_crud 13/13, e2e_timer 79/79. e2e_timer's old
  soft-todo-delete assertion updated to hard delete. Migration 0007 verified.
- 2026-06-16 verify: VAL-HD-001..005 + VAL-ICON-001/002 met. Two pre-existing failures isolated to
  master via stash (e2e_buckets reorder-persist; e2e_i18n_notes stale `[data-view=main]` selector) —
  out of scope, flagged in HANDOFF.
- 2026-06-16 defect+fix (VAL-VIS-001): user reported the history delete icon was not visible. Cause:
  `.row-delete` base `opacity: 0` with a reveal rule only for `.task-row:hover`; history rows
  (`.log-item`/`.history-todo`) had none → icon invisible (e2e clicked by selector so it missed
  this). Fix: history override `opacity: 0.35` at rest, `1` on hover. Added VAL-VIS-001 acceptance +
  resting-opacity e2e guards (now 16/16). Verified visually via screenshot.
