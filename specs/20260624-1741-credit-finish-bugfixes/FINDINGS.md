# Findings: credit-on-finish bug fixes

## Audit (claude Explore + codex)

Two independent passes over the timer/credit flow agreed on three real bugs:

- **BUG-1 (root cause of "did not credit")** — `Repository.create_block`
  (`backend/repository.py:186`) ended *every* open block before inserting the new one with
  `completed=False`. A finished pomo still sitting in the credit modal is an open block, so a
  new Start (second tab/device, or after a credit failure) silently aborted it and the later
  `POST /credit` 404'd. The frontend credit path itself (start/restore seed `touchedTaskIds`
  with the anchor; modal seeds + filters correctly) was sound — the loss was backend.
- **BUG-2** — `completeBlockWithCredit` (`frontend/app.js`) returned on a failed credit POST,
  leaving the finished block alive but modal-less; the next Start clobbered it via the BUG-1
  sweep.
- **BUG-3** — `renderTodayLog` (`frontend/app.js:1051`) labelled groups `task_name || note`,
  hiding the record on assigned pomos. (Commit `4bf4a0f` only partly addressed this; History
  already used `note || task_name`.)

## Decision

BUG-1 fix approach chosen by user: **auto-credit a finished leftover.** The single-open-block
sweep keeps `completed=True` when the leftover already ran its full duration (credit its
anchor), and only aborts truly-unfinished leftovers — so a finished pomo is never dropped,
while the dedup invariant ("one open block") holds. BUG-2: retry loop keeps the block and
re-opens the modal.

BUG-3 here supersedes the note-display part of pending spec `20260622-1823-credit-note-and-cancel`;
that spec's Cancel work is independent and untouched.

## Note on time handling

sqlite returns `Block.started_at` tz-naive while `utcnow()` is tz-aware; `create_block` now
normalizes the stored time to UTC before computing elapsed (`repository.py`).

## Execution Log

- T1 done — `create_block` per-block sweep (finished→completed, else abort). `repository.py`.
- T2 done — `test_start_block_keeps_finished_leftover_credited` added; existing
  `test_start_block_closes_previous_open_block` still green (unfinished still aborts).
- T3 done — retry loop in `completeBlockWithCredit`; `note || task_name` in `renderTodayLog`.
- T4 done — `tests/e2e/credit-finish-bugfixes.spec.js` (route-fail retry + note in Today log).
- T5 done — full verify green.

## Verification

- `uv run pytest -q` → 54 passed
- `npx playwright test timer skip break-resume credit-finish-bugfixes` → 10 passed
- `npm test` → 18 passed
