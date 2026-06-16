# Editable Work-Block Record

## Intent

When a work (pomodoro) block finishes, the credit modal currently only asks
*which touched tasks to credit* (checkboxes). Add a single free-text **record**
field to that modal: an editable, human-readable line describing what was worked
on. It is pre-filled from the names of the tasks currently checked-to-credit
(e.g. `Write report + Fix login`) and updates live as boxes are toggled, until
the user edits it by hand. The saved record replaces the task name wherever that
block is listed in the logs.

This keeps the existing per-task credit (streak + `blocks_done` counters)
exactly as is; the record is an additional, optional label on the block.

## Behavior

- Modal shows one text input below the credit checklist, seeded with the checked
  task names joined by ` + `.
- Toggling a checkbox re-seeds the text from the now-checked tasks — **unless**
  the user has manually edited it, after which auto-seeding stops (dirty flag).
- Confirming credit saves the (trimmed) text as the block's `note`. Empty is
  allowed and stored as `""`.
- In the **History** pomodoro list, a block with a non-empty `note` displays the
  note in place of its task name; a block with no note shows the task name as
  before.
- The record attaches to the block that ran (the credited `block_id`). Extra
  per-task credit rows are unaffected and keep showing their task name.

## Out of scope

- The **today-log** (Today view) stays grouped by task and unchanged — a
  per-block free-text record doesn't aggregate there. Record shows in History.
- Editing the record later from the history view (credit-time only).
- Changing what credit does to streaks / `blocks_done`.
- Break blocks (no record; breaks have no block row).

## Acceptance

### VAL-REC-001: Record field seeded from checked tasks
Given a work block finishes with tasks "A" and "B" touched and both checked.
When the credit modal opens.
Then the record input value is `A + B`.
Evidence: tests/e2e_timer.js check "VAL-REC-001"

### VAL-REC-002: Toggling a checkbox re-seeds the record
Given the credit modal is open and the record has not been hand-edited.
When task "B" is unchecked.
Then the record input value becomes `A`.
Evidence: tests/e2e_timer.js check "VAL-REC-002"

### VAL-REC-003: Manual edit stops auto-seeding
Given the user typed a custom record.
When a checkbox is toggled afterward.
Then the typed text is preserved (not overwritten).
Evidence: tests/e2e_timer.js check "VAL-REC-003"

### VAL-REC-004: Confirm saves the record to the block
Given a record value `shipped the thing`.
When credit is confirmed.
Then the credited block row persists `note = "shipped the thing"`.
Evidence: pytest tests/test_block_record.py::test_credit_saves_note

### VAL-REC-005: Record replaces task name in the History list
Given a credited block with a non-empty note.
When the History pomodoro list renders it.
Then the line shows the note text, not the task name.
Evidence: tests/e2e_timer.js check "VAL-REC-005"

### VAL-REC-006: Blocks without a note still show the task name
Given a credited block with an empty note (older blocks, or a cleared field).
When the History list renders.
Then the line shows the task name.
Evidence: pytest tests/test_block_record.py::test_credit_saves_note (asserts default "") + e2e check "VAL-REC-006"

### VAL-REC-007: No regression
Given the full backend + e2e suites.
When they run.
Then pytest passes and e2e reports `failedCount: 0`.
Evidence: pytest -q ; cmux browser eval tests/e2e_timer.js → {"failedCount":0}
