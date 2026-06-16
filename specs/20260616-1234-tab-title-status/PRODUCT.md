# Tab Title Live Status

## Intent

Surface the running block in the browser tab title so the user can read current
status without focusing the app. While a block is active the `<title>` mirrors
the timer: countdown first (most visible when tabs are pinned/narrow), then the
block type, then the task name for work blocks.

Scope is the frontend only. No backend, no API, no behavior change to the timer
itself — this is a read-only projection of existing state into `document.title`.

## Format (decided)

| State | `document.title` |
|-------|------------------|
| Work running | `24:31 · Work: Write report` |
| Work running, no task name | `24:31 · Work` |
| Rest running (short/long) | `04:00 · Rest` |
| Paused (work or rest) | `⏸ 12:03 · Work: Write report` |
| Idle (no active block) | `Pomotodo` |

- "Timer first" ordering: countdown is the leftmost, never-truncated segment.
- Separator is ` · ` (U+00B7).
- Type label comes from i18n (`Work` / `Rest`), so it localizes with the UI.
- Paused is marked with a leading `⏸ ` (paused = block exists, not ticking).
- Idle restores the static `Pomotodo`.

## Acceptance

### VAL-TAB-001: Work block shows timer, type, and task name
Given a pomodoro block is running for a task named "Write report".
When the title updates.
Then `document.title` equals `<MM:SS> · Work: Write report`, where `<MM:SS>` is
the formatted remaining time.
Evidence: tests/e2e_timer.js check "VAL-TAB-001"

### VAL-TAB-002: Rest block shows timer and Rest, no task name
Given a short or long break is running.
When the title updates.
Then `document.title` equals `<MM:SS> · Rest` with no task name appended.
Evidence: tests/e2e_timer.js check "VAL-TAB-002"

### VAL-TAB-003: Paused block is marked and frozen
Given a running block is paused.
When the title updates.
Then `document.title` starts with `⏸ ` followed by the frozen `<MM:SS>` and the
same type/name segment it had while running.
Evidence: tests/e2e_timer.js check "VAL-TAB-003"

### VAL-TAB-004: Idle restores the default title
Given no block is active (fresh load, or a block just completed/aborted).
When the title updates.
Then `document.title` equals `Pomotodo`.
Evidence: tests/e2e_timer.js check "VAL-TAB-004"

### VAL-TAB-005: Title tracks the countdown each second
Given a block is running.
When a second elapses and `state.remainingSeconds` decrements.
Then the `<MM:SS>` segment of `document.title` updates to match.
Evidence: tests/e2e_timer.js check "VAL-TAB-005"

### VAL-TAB-006: No regression in existing timer behavior
Given the full e2e timer run.
When it completes.
Then it reports `failedCount: 0` and all pre-existing checks still pass.
Evidence: SCRIPT=$(cat tests/e2e_timer.js); cmux browser eval --surface <id> "$SCRIPT" → {"failedCount":0}
