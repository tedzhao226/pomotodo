# Taskless Pomodoro + Pin Tasks

## Intent

### Taskless pomodoro start

Today, starting a work (pomodoro) block **requires** selecting a task first — START
is disabled until one is picked (`frontend/app.js` `renderTimer`, `docs/timer-states.md`).
Users often want to press START immediately and decide afterward what they worked on.

Allow starting a pomodoro **without** a pre-selected task. When that block finishes
naturally, open the existing credit modal populated from the **Today** list so the
user can register which task(s) they completed. Mid-block task clicks still build
the touched set (unchanged); only the completion checklist source changes for
taskless-started blocks.

Task-selected starts keep today's behavior: completion checklist = touched tasks,
all checked by default.

### Pin task to top

Today and Backlog lists are ordered server-side (`sort_order`, drag-reorder on Today).
Users want a one-click way to float an important task to the **top of its bucket**
without dragging.

Add a **pin** button on each task row. Clicking it moves that task to index 0 in
its current bucket (Today or Backlog) and persists via the existing reorder API.

## Behavior

### Taskless pomodoro

- **Idle pomodoro tab**: START is enabled even when no task is selected. Timer label
  stays "No task selected".
- **Start without selection**: creates a server block with no anchor task
  (`task_id = null`). No list row is highlighted; touched chips stay hidden until
  the user clicks a task mid-block.
- **Mid-block** (taskless or not): clicking a Today/Backlog task still switches
  active task (with confirm) and adds to `touchedTaskIds` — unchanged.
- **Completion (taskless-started block)**: credit modal lists every non-done task in
  the **today** bucket (same filter as the Today panel). Tasks in `touchedTaskIds`
  are pre-checked; if the user never touched a task, nothing is pre-checked. User
  picks what to credit and confirms (existing record field + POST credit unchanged).
- **Completion (task-selected block)**: unchanged — checklist = touched tasks, all
  checked by default.
- **Abort / skip / Esc**: unchanged — no credit.
- **Rehydrate** a running taskless block on load: resume timer, no selected/active
  task until the user clicks one.
- **Auto-start next pomodoro** after a break: if the finished block was taskless,
  start the next block taskless too (don't resurrect a stale `selectedTaskId`).

### Pin to top

- Each task row gains a **pin** control in `.row-actions` (before move/edit/delete).
- Click **pin** → task moves to the top of its **current bucket** (Today or Backlog).
  Other tasks in that bucket keep their relative order below it.
- Order persists server-side (`PATCH /api/tasks/order`) and survives sync/reload.
- If the task is **already first** in its bucket, pin is a no-op (button may stay
  visible but does nothing).
- Pin is **disabled while a tag filter is active** (same rule as drag-reorder — the
  filtered view is not the authoritative bucket order).
- Pin does not change bucket, status, or timer selection.

## Out of scope

- Backlog tasks in the post-hoc credit list (Today only, per request).
- Creating a new task from the credit modal (pick an existing Today task).
- Changing break behavior, streak rules, or the record field semantics.
- Allowing taskless **break** starts (breaks already have no task).
- Persistent "pinned" flag that survives new tasks being added (pin = move to top,
  not sticky pin).
- Pinning across buckets (Today pin stays in Today; Backlog pin stays in Backlog).

## Acceptance

### VAL-FREE-001: START enabled without a selected task

Given the pomodoro tab is idle and no task is selected.
When the UI renders timer controls.
Then the START button is enabled and the label reads "No task selected".
Evidence: tests/e2e_timer.js check "VAL-FREE-001"

### VAL-FREE-002: Taskless start creates a running block with no anchor task

Given no task is selected.
When the user clicks START.
Then `state.activeBlock` is set, `state.activeTaskId` is null, the timer runs, and
the server `running_block.task_id` is null.
Evidence: tests/e2e_timer.js check "VAL-FREE-002"

### VAL-FREE-003: Task-selected start is unchanged

Given a Today task is selected.
When the user clicks START.
Then the block anchors to that task, it is active + touched, and behavior matches
the existing VAL-3 e2e checks.
Evidence: tests/e2e_timer.js — existing VAL-3 still passes

### VAL-FREE-004: Taskless completion shows Today list in credit modal

Given a taskless-started block finishes with Today tasks A and B present.
When the credit modal opens.
Then the checklist lists Today tasks (not Backlog), nothing is pre-checked if no
task was touched mid-block.
Evidence: tests/e2e_timer.js check "VAL-FREE-004"

### VAL-FREE-005: Crediting a Today task from a taskless block

Given a taskless block completes and the user checks task A and confirms.
Then A's `blocks_done` increments by 1, the block is completed, and the streak bumps
once.
Evidence: tests/e2e_timer.js check "VAL-FREE-005"; pytest tests/test_taskless_block.py

### VAL-FREE-006: Mid-block touch pre-checks on taskless completion

Given a taskless-started block where the user switched to task B mid-block.
When the block completes.
Then the Today-list modal opens with B pre-checked (others unchecked unless also
touched).
Evidence: tests/e2e_timer.js check "VAL-FREE-006"

### VAL-PIN-001: Pin button on task rows

Given an unfiltered Today or Backlog list with at least two tasks.
When a row is hovered.
Then a pin button is visible in the row actions.
Evidence: tests/e2e_buckets.js check "pin: button present"

### VAL-PIN-002: Pin moves task to top of bucket

Given Today tasks A (first) and B (second).
When the user clicks pin on B.
Then B renders above A in the Today list.
Evidence: tests/e2e_buckets.js check "pin: moves to top"

### VAL-PIN-003: Pin order persists after sync

Given a task was pinned to the top of Today.
When `syncNow()` runs.
Then the pinned task remains first in DOM order.
Evidence: tests/e2e_buckets.js check "pin: order persisted after sync"

### VAL-PIN-004: Pin disabled under tag filter

Given a tag filter is active on the Today list.
When the list renders.
Then pin buttons are disabled or absent and drag remains disabled.
Evidence: tests/e2e_buckets.js check "pin: disabled when filtered"

### VAL-FREE-007: No regression

Given the full backend + frontend test suites.
When they run.
Then pytest passes, vitest passes, and e2e reports `failedCount: 0`.
Evidence: pytest -q && npm test && cmux browser eval tests/e2e_timer.js && cmux browser eval tests/e2e_buckets.js
