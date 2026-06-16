# Pomo de-dup + soft-delete for pomos and todos

## Intent

Two related History-record fixes on the web app (FastAPI backend + `frontend/`):

1. **One pomo per timer session.** Crediting several touched tasks from a single
   work block currently writes one completed `Block` row per credited task, so a
   single 30-minute session shows as multiple "pomos" in History (and inflates
   the pomo count and stats). A real timer block should appear exactly once,
   named with the combined record note.
2. **Soft-delete in History.** The user can soft-delete a pomo or a todo from the
   History view. Soft-deleted items leave the History lists and stop counting in
   Statistics; the rows are kept in the database (recoverable), not hard-deleted.

Scope: backend + web frontend. The TUI (separate branch) is a pure client of the
same API and inherits the backend behavior; TUI delete UI is out of scope here.

Non-goals: hard delete, undo/restore UI, changing the credit modal's seed/edit
behavior, changing the timer engine.

## Background (current behavior)

- `repository.credit_block` marks the started ("anchor") block completed only if
  its task was credited, writes the note to it, and adds an extra completed
  `Block` (with `note` copied) for every other credited task. Every completed
  block shows in History and counts in stats.
- Todos already soft-delete via `Task.archived` (`DELETE /api/tasks/{id}`), but
  archived todos' blocks still count in stats, and History has no delete control.
- `Block` has no `archived` column, delete endpoint, or UI.

## Acceptance

### VAL-DEDUP-001: One pomo per credited timer block
Given a work block that touched tasks A and B.
When it is credited (any subset of A/B checked) with note N.
Then exactly one completed pomo exists for that block, its note is N, and no
extra per-task block rows are created.
Evidence: `uv run pytest tests/test_block_record.py -k dedup`

### VAL-DEDUP-002: The single pomo is attributed to a credited task
Given a block started on A, switched to B, and credited to only B.
When it is credited.
Then the one pomo is attributed to B (its `task_id`/tags resolve to B), not left
on the uncredited anchor A, and A produces no separate pomo.
Evidence: `uv run pytest tests/test_block_record.py -k attribut`

### VAL-DEDUP-003: Pomo count reflects real sessions
Given two real timer blocks, one crediting two tasks.
When History and stats are read.
Then "finished pomos" / `all_time_pomos` equals 2 (one per block), not 3.
Evidence: `uv run pytest tests/test_block_record.py -k count`

### VAL-PDEL-001: A pomo can be soft-deleted from History
Given a completed pomo.
When `DELETE /api/blocks/{id}` is called.
Then the block is marked archived (row kept, not removed) and no longer appears
in the History pomos list.
Evidence: `uv run pytest tests/test_block_delete.py -k "pomo_soft_delete or history"`

### VAL-PDEL-002: A soft-deleted pomo is excluded from stats
Given a completed pomo counted in stats.
When it is soft-deleted.
Then it is excluded from `all_time_pomos`, tag summaries, the trend/blocks list,
and the owning task's `blocks_done`.
Evidence: `uv run pytest tests/test_block_delete.py -k "pomo_stats"`

### VAL-TDEL-001: Deleting a todo archives it but keeps its pomos
Given a todo with completed pomos.
When the todo is soft-deleted (archived) from History.
Then the todo leaves the active lists and renders as deleted in History, while its
already-completed pomos REMAIN in History and continue to count in stats.
(Decision 2026-06-16: preserve the existing keeps-history behavior; only the
deleted todo itself is hidden from active lists, not its logged pomos.)
Evidence: `uv run pytest tests/test_bucket.py -k "keeps_history"`

### VAL-UI-001: History has working delete controls for pomos and todos
Given the History view with pomos and todos.
When the user clicks delete on a pomo row and on a (non-deleted) todo row.
Then the pomo calls `DELETE /api/blocks/{id}` and disappears; the todo calls
`DELETE /api/tasks/{id}` and shows as deleted; both reflect immediately.
Evidence: cmux browser eval `tests/e2e_timer.js` VAL-DEL checks → `{"failedCount":0}`

### VAL-REG-001: No regression in existing suites
Given the full backend suite and the timer e2e.
When they run after these changes.
Then `uv run pytest -q` is green and `tests/e2e_timer.js` reports
`failedCount: 0` (existing VAL-REC updated to the one-pomo model).
Evidence: `uv run pytest -q`; cmux browser eval `tests/e2e_timer.js`
