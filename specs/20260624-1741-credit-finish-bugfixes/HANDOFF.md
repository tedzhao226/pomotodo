# Handoff: credit-on-finish bug fixes — DONE

All three audited bugs fixed and verified. Acceptance VAL-BUG1-001/002, VAL-BUG2-001,
VAL-BUG3-001 met.

## Changes

| File | Change |
|------|--------|
| `backend/repository.py` | `create_block` single-open-block sweep now keeps a finished leftover (`completed=True`, credit its anchor) and only aborts unfinished ones; normalizes tz-naive `started_at`. |
| `frontend/app.js` | `completeBlockWithCredit` wraps modal+POST in a retry loop (failed credit keeps the block, re-opens the modal). `renderTodayLog` uses `note \|\| task_name`. |
| `tests/test_block_record.py` | `test_start_block_keeps_finished_leftover_credited`. |
| `tests/e2e/credit-finish-bugfixes.spec.js` | new — BUG-2 retry + BUG-3 note display. |

## Verification (all green)

- `uv run pytest -q` → 54 passed
- `npx playwright test timer skip break-resume credit-finish-bugfixes` → 10 passed
- `npm test` → 18 passed

## Not done / follow-ups

- The credit-modal **Cancel** button (pending spec `20260622-1823-credit-note-and-cancel`)
  is unrelated and still pending. Its note-display task is now redundant (done here).
- BUG-1's safety-net auto-credit attributes the leftover to its **anchor** task with an empty
  note (no user task/note picking) — correct for the abnormal path, but worth knowing.
