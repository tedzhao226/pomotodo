# Approach

All change is in `frontend/app.js`. The state already carries a task across the break
via `pendingTaskId`/`pendingTaskless`, but only the **auto-start** path reads it; the
**manual** path reads `selectedTaskId`, which was nulled at block end. Fix = stop nulling
the selection, carry it instead, and route both paths through one detach rule.

## Changes

1. **`finishBlock` / `completeBlockWithCredit`** — replace `state.selectedTaskId = null`
   with carrying the block's task:
   - `finishBlock`: `state.selectedTaskId = block.task_id ?? null`.
   - `completeBlockWithCredit`: `state.selectedTaskId = lastActive ?? null`, and align
     `pendingTaskless = lastActive == null` (so a task assigned to a taskless block
     resumes on both manual and auto paths).

2. **`updateTimerControls`** — the single detach point. It already prunes a stale
   `selectedTaskId` when the task is gone; extend it to also prune when the task is
   `status === "done"`, and apply the same prune to `pendingTaskId`
   (clearing `pendingTaskless`). `renderAll → renderDashboard → updateTimerControls`
   runs on every mutation, so marking a task done (during break, during pomo, or via
   server sync) detaches it automatically — no special-casing in the mark-done handler.

No backend, schema, or i18n change. Break assignment is already a no-op (clicking a task
with no `activeBlock` only toggles `selectedTaskId`).

## Tests

New spec `tests/e2e/break-resume.spec.js` (models `skip.spec.js`):

- VAL-BREAK-001: complete a block on T (skip ≥1/3 + credit), assert `selectedTaskId===T`
  in break; start next pomo, assert `activeBlock` opens on T.
- VAL-BREAK-002: skip <1/3 (discard), assert `selectedTaskId===T` in break.
- VAL-BREAK-003: in break with T carried, mark T done, assert `selectedTaskId===null`
  and `pendingTaskId===null`.
- VAL-BREAK-004: taskless block → break, assert `selectedTaskId===null`.

## Verification commands

```sh
npx playwright test break-resume      # new behavior
npx playwright test skip timer        # regression on adjacent state-machine specs
uv run pytest -q                      # backend unchanged, sanity
npm test                              # frontend unit, sanity
```
