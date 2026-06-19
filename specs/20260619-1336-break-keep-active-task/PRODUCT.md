# Break keeps the active task attached

## Intent

When a pomodoro ends and the app goes to a break, the just-worked task should stay
**selected** through the break, so returning to a pomodoro resumes the same task —
no re-picking. A break needs no task assignment of its own.

The carry detaches only when the task is **marked done**: a finished task should not
ride into the next pomodoro.

This consolidates the existing carry-over (`pendingTaskId`/`pendingTaskless`, added in
`15e20f2`) so the manual return-to-pomodoro path and the auto-start path agree on one
"what the next pomo resumes" value, with a single detach rule.

## Acceptance

### VAL-BREAK-001: Completed pomo keeps its task selected across the break
Given a pomodoro running on task T.
When it completes (natural end or skip-with-credit) and the app enters a break.
Then `state.selectedTaskId === T` during the break, and starting the next pomodoro
opens a block on T.
Evidence: npx playwright test break-resume

### VAL-BREAK-002: Skipped/discarded block keeps its task selected
Given a pomodoro running on task T.
When the user skips to a break — credited (≥1/3) or discarded (<1/3).
Then `state.selectedTaskId === T` during the break.
Evidence: npx playwright test break-resume

### VAL-BREAK-003: Marking the task done detaches it
Given a break with task T carried as the selection.
When T is marked done.
Then `state.selectedTaskId === null` and `state.pendingTaskId === null`, so the next
pomodoro does not resume T.
Evidence: npx playwright test break-resume

### VAL-BREAK-004: A taskless block carries nothing
Given a taskless pomodoro that ends into a break.
When the break is entered.
Then `state.selectedTaskId === null` (nothing to resume).
Evidence: npx playwright test break-resume
