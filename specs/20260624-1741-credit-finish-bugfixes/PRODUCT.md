# Credit-on-finish bug fixes

## Intent

A finished pomo must always credit its task. An audit (claude Explore + codex) of the
timer/credit flow surfaced three real bugs around the finish→credit path; this fixes all
three.

- **BUG-1 — finished pomo silently aborted (the reported "did not credit" bug).**
  `Repository.create_block` enforces "at most one open block" by ending *every* open block
  before inserting the new one, with `completed=False`. A pomo whose timer has elapsed but
  is still sitting in the credit modal is an open block; if a new pomo starts first (second
  tab/device, or after a credit failure), that finished pomo is aborted and the later
  `POST /credit` 404s — the pomo is lost. Fix: when the single-block sweep ends a leftover
  block that already ran its **full duration**, mark it `completed=True` (credit to its
  anchor task) instead of aborting. Truly-unfinished leftovers still abort, as today.

- **BUG-2 — credit failure strands the finished block.** When `POST /credit` fails,
  `completeBlockWithCredit` only shows an error and returns, leaving the finished block alive
  in client state with the modal gone. The next Start clobbers it (via the BUG-1 sweep) and
  the credit is lost. Fix: on credit failure keep the block and re-open the modal so the user
  can retry.

- **BUG-3 — Today log hides the credit record on assigned pomos.** `renderTodayLog` labels
  each group `b.task_name || b.note`, so an assigned pomo with a custom record shows the task
  name and hides the note. History already renders `note || task_name`. Fix: flip to
  `b.note || b.task_name` to match.

No schema change. BUG-3 supersedes the note-display portion of the pending spec
`20260622-1823-credit-note-and-cancel` (its Cancel work is unaffected).

## Acceptance

### VAL-BUG1-001: A finished leftover pomo keeps its credit when a new pomo starts
Given an open block whose `started_at` is older than its full `duration_min`.
When `create_block` runs (a new pomo starts).
Then the leftover block is ended with `completed=True`, its anchor task is credited, and
`all_time_pomos` counts it.
Evidence: `uv run pytest -q tests/test_block_record.py`

### VAL-BUG1-002: An unfinished leftover pomo still aborts (no duplicate credit)
Given an open block started moments ago (not past its duration).
When a new pomo starts.
Then the leftover is ended `completed=False` and crediting it is rejected — unchanged from
today (`test_start_block_closes_previous_open_block` stays green).
Evidence: `uv run pytest -q tests/test_block_record.py`

### VAL-BUG2-001: Credit failure keeps the modal retryable
Given the credit modal open after a block completes, and `POST /credit` fails once.
When the failure occurs.
Then the block is not lost (`state.activeBlock` stays set) and the credit modal re-opens; a
subsequent successful Confirm credits exactly one pomo.
Evidence: `npx playwright test credit-finish-bugfixes`

### VAL-BUG3-001: Today log shows the credit record on an assigned pomo
Given an assigned pomo credited with a custom record (note) text.
When the Today panel renders.
Then the log row shows the note; a blank note falls back to the task name (unchanged).
Evidence: `npx playwright test credit-finish-bugfixes`
