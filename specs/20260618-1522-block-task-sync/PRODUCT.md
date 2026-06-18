# Persist mid-block task changes (touched set) to the server

## Intent

During a running work block you can switch the active task and touch several
tasks; the credit checklist offers them all on completion. But that **touched set
(and the post-switch active task) lives only on the client** — the server block
keeps a single `task_id`. So if you change the course of a block mid-work and the
page reloads/syncs, every touched task except the anchor is **lost** (the bug:
"multiple tasks' state didn't persist"). The completion checklist then misses
them.

Persist the block's task state — the **active task** and the **touched set** — to
the server on every mid-block change, and restore both on rehydrate.

### State-sync audit (the broader ask)

| event | persisted before | after |
|---|---|---|
| task CRUD / move / reorder / pin / toggle | ✅ | ✅ |
| block start / complete / abort / credit / break | ✅ | ✅ |
| **mid-block task switch (touched grows)** | ❌ client-only | ✅ |
| **touched-chip remove** | ❌ client-only | ✅ |
| **active task after a switch** | ❌ (anchor only) | ✅ |
| pause / resume | ❌ (rehydrate assumes continuous run) | unchanged (out of scope) |

## Behavior

- A running block stores a **touched-task set** server-side plus its current
  active task (`block.task_id`).
- On every mid-block task change — assign, switch, chip-remove — the client
  `PUT`s the current `{active_task_id, touched_task_ids}` to the server.
- `running_block` (dashboard) returns `touched_task_ids`; rehydrate restores
  `state.touchedTaskIds` and `activeTaskId` from it.
- The single-purpose `POST /blocks/{id}/assign` is consolidated into the new
  `PUT /blocks/{id}/tasks` (assign = active+touched of one task).
- Completion/credit unchanged (the client already sends the checked task_ids).

## Out of scope

- Pause/resume persistence (separate; rehydrate still assumes continuous run).
- Cross-device live mirroring of the touched set mid-block (this only fixes
  reload/sync persistence + rehydrate).

## Acceptance

### VAL-SYNC-001: Touched set persists across switches
Given a running block (anchored on A) where the user switches A→B→C.
When each switch happens.
Then the server `running_block.touched_task_ids` becomes {A,B,C}; `task_id` stays
the **anchor A** (credit/dedup attributes the single pomo to the anchor, so
switches must not move it).
Evidence: pytest tests/test_block_tasks.py; e2e block-sync spec.

### VAL-SYNC-002: Rehydrate restores the touched set
Given a running block with touched {A,B,C} persisted.
When the client rehydrates from the dashboard.
Then `state.touchedTaskIds` = {A,B,C}; `state.activeTaskId` resolves to the anchor
(A) on reload. (The live active highlight follows switches in-session; only the
touched set — the credit candidates — needs server persistence.)
Evidence: e2e block-sync spec — "rehydrate restores touched".

### VAL-SYNC-003: Chip-remove persists
Given a touched set {A,B,C}.
When the user removes B's chip.
Then the server touched set becomes {A,C}.
Evidence: e2e block-sync spec — "chip remove persists".

### VAL-SYNC-004: Taskless assign still works via the consolidated endpoint
Given a taskless block; the user assigns task A.
Then `running_block.task_id` = A and touched = {A} (rehydrate keeps A).
Evidence: pytest; existing taskless persistence behavior preserved.

### VAL-SYNC-005: No regression
Given the suites.
When they run.
Then `pytest`, `vitest`, and `npm run e2e` pass.
Evidence: suites green.
