# Editing a task froze its pomo count ("no credit after pomo")

## Intent

A completed pomodoro should always credit the task it ran on, and the task row
should show that live count (`done/estimate`). It didn't: after a while a task
would sit at `0/N` no matter how many pomos finished on it.

Root cause (found from staging data): the task model carried a manual
`blocks_override`. The inline editor pre-filled a "done" field with the current
count and the save handler sent it on **every** save, so any edit (rename,
estimate, note) silently latched the current count into a permanent override.
The dashboard returned `override ?? computed`, so the frozen override masked the
real completed-block count. On staging, task "interivew prep" had 3 completed
blocks (`task_id=38, completed=true`) but `blocks_override=0` → displayed `0/4`.
15 tasks were poisoned this way.

Decision: remove the manual override entirely. `blocks_done` is always the live
completed-block count; pomos drive it, nothing freezes it.

## Acceptance

### VAL-EDIT-CREDIT-001: editing a task does not freeze its pomo count
Given a task with 0 completed pomos.
When the task is edited and saved (e.g. its estimate is set), then a pomo is
finished on it and credited.
Then the task's `blocks_done` is 1 (the edit did not latch the count).
Evidence: `npx playwright test edit-keeps-credit`

### VAL-OVERRIDE-GONE-001: blocks_override is removed end to end
Given the running app and DB.
Then there is no `blocks_override` column, no schema/editor field that writes it,
and the dashboard/task-list `blocks_done` equals the completed-block count.
Evidence: `uv run pytest -q` (58 passed); `grep -r blocks_override backend frontend`
returns nothing; staging shows interivew prep `3/4` after migration 0011.
