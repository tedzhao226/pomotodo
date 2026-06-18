# HANDOFF — Persist mid-block task state

## Outcome: DONE

Mid-block task changes (switch, chip-remove) now persist server-side and survive
a reload — the touched set is no longer client-only. The reported bug ("multiple
tasks' state didn't persist mid-block") is fixed.

## Changes
- Backend: `BlockTouch` table + migration 0009; `set_block_tasks` (anchor kept,
  touched set replaced); `get_running_block` returns `touched_task_ids`;
  `PUT /blocks/{id}/tasks` replaces `POST /blocks/{id}/assign`.
- Frontend: `syncBlockTasks()` PUTs `{active_task_id, touched_task_ids}` on every
  assign/switch/chip-remove; rehydrate restores the full touched set.

## Key decision
`task_id` stays the **anchor** (credit/dedup attributes the pomo to it). Switches
only grow the touched set; on reload the active highlight resolves to the anchor.
This is why persisting the active task into `task_id` was reverted (it broke
timer VAL-DEDUP-001).

## Acceptance
VAL-SYNC-001/003 (server touched persists, chip-remove) + 002 (rehydrate) →
test_block_tasks (4) + block-sync.spec.js (1). VAL-SYNC-004 → taskless tests.
VAL-SYNC-005 → e2e 13, pytest 52, vitest 12.

## Audit (the broader ask)
State-sync table in PRODUCT.md/FINDINGS.md. Only remaining client-only gap:
pause/resume (rehydrate assumes continuous run) — intentionally out of scope.
