# Pomo-finish credit: two scenarios

When a work block (pomo) completes, the credit modal must behave differently
depending on whether the pomo was started with a task.

A finished pomo is **one counted block attributed to one task** (`block.task_id`).
Extra checked tasks never add blocks — they only enrich the record/note. (Confirmed
by `tests/test_block_record.py`; `docs/timer-states.md` currently states this wrong
and is corrected as part of this work.)

## Feature checklist

### Scenario 1 — unassigned pomo finishes (`block.task_id == null`)
- [ ] Modal lists **all Today tasks** (bucket=today, not done) to pick from.
- [ ] Any task touched mid-block (assigned later) is pre-checked.
- [ ] The first checked task becomes the pomo's task; all checked names form the note.
- [ ] Checking nothing → pomo recorded taskless, note still saved.

### Scenario 2 — assigned pomo finishes (`block.task_id != null`)
- [ ] Modal shows the **assigned + mid-block-touched** tasks first, pre-checked,
      as the *creditable* group (these own the pomo).
- [ ] A divider separates a second *label-only* group: **all other Today tasks**,
      unchecked, captioned "also worked on (no credit)".
- [ ] Ticking a label-only task only appends its name to the note — it never
      reassigns the block, never adds a pomo. The pomo stays on the assigned task.
- [ ] Unchecking the assigned task and ticking only label-only tasks leaves the
      pomo attributed to the assigned task (label-only ids are not sent to credit).

### Shared
- [ ] One finished pomo = exactly one counted block (not one per checked task).
- [ ] Abort / skip credits nothing.
- [ ] No backend change — frontend filters which checked ids reach `POST /credit`.

## Acceptance

### VAL-CR-001: Unassigned finish lists all Today tasks
Given a pomo started with no task and some Today tasks.
When it completes.
Then the credit modal lists every Today task (not done); mid-block-touched ones pre-checked.
Evidence: screenshot of the modal.

### VAL-CR-002: Assigned finish shows creditable group + label-only Today group
Given a pomo started on task A with other Today tasks present.
When it completes.
Then the modal shows A (and any switched-to task) checked above a divider, and the
other Today tasks unchecked below it labelled no-credit.
Evidence: screenshot of the modal.

### VAL-CR-003: Label-only ticks are note-only
Given the assigned-finish modal with A checked and Today task B ticked below the divider.
When confirmed.
Then the block stays attributed to A, exactly one pomo is counted, and B appears only
in the note.
Evidence: pytest tests/test_block_record.py (single-block contract) + screenshot.

### VAL-CR-004: One finished pomo = one counted block
Given any credit confirm with N checked tasks.
Then `all_time_pomos` increases by exactly 1.
Evidence: pytest tests/test_block_record.py::test_credit_block_dedup_records_one_pomo_with_note

### VAL-DOC-001: Design doc corrected
Given `docs/timer-states.md`.
Then it no longer claims "each checked task earns +1 block", documents both finish
scenarios, and carries the feature checklist.
Evidence: read the doc.
