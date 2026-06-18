# TECH — Persist mid-block task state

## Backend

- **Model** (`backend/models.py`): `BlockTouch` join table — `block_id`
  (FK blocks, PK, ondelete CASCADE), `task_id` (FK tasks, PK, ondelete CASCADE).
  The touched-task set for a block. `block.task_id` stays the active task.
- **Migration** `0009_block_touches` — create `block_touches`.
- **Repository**:
  - `set_block_tasks(block_id, active_task_id, touched_task_ids) -> dict | None`:
    return None if block missing/ended; else `block.task_id = active_task_id`,
    delete existing `block_touches` rows, insert the new set; return block dict.
  - `get_running_block`: add `"touched_task_ids": [sorted task ids]`.
- **Service**: `set_block_tasks(...)` — validate each task id exists (active +
  touched), raise NotFound; call repo; raise NotFound on missing/ended block.
- **Schema** (`backend/schemas.py`):
  - `SetBlockTasksRequest{ active_task_id: int | None, touched_task_ids: list[int] }`
  - `RunningBlock` gains `touched_task_ids: list[int]`.
  - Remove `AssignBlockRequest`.
- **API** (`backend/api.py`): `PUT /blocks/{id}/tasks` → `set_block_tasks`.
  Remove `POST /blocks/{id}/assign`.

## Frontend (`frontend/app.js`)

- Helper:
  ```
  async function syncBlockTasks() {
    if (!state.activeBlock) return;
    try {
      await api(`/api/blocks/${state.activeBlock.id}/tasks`, {
        method: "PUT",
        body: JSON.stringify({
          active_task_id: state.activeTaskId,
          touched_task_ids: [...state.touchedTaskIds],
        }),
      });
    } catch (e) { els.timerMode.textContent = t("err.endBlock", {msg: e.message}); }
  }
  ```
- Call `syncBlockTasks()` after: the mid-block activate branch (both the taskless
  assign *and* the switch — replaces the old `/assign` call), and the chip-remove
  handler (after `touchedTaskIds.delete`).
- Rehydrate: `state.touchedTaskIds = new Set(rb.touched_task_ids ?? (rb.task_id != null ? [rb.task_id] : []))`;
  `state.activeTaskId = rb.task_id`.

## Tests

- **pytest** `tests/test_block_tasks.py`: start block; `set_block_tasks(b, C,
  [A,B,C])` → `get_running_block().touched_task_ids == [A,B,C]`, `task_id == C`;
  removing B → [A,C]; unknown task → NotFound. Update `test_taskless_block.py`
  assign tests to the new endpoint/service.
- **e2e** `tests/e2e/block-sync.spec.js`: start block on A, switch A→B→C, assert
  server touched = {A,B,C}; force a rehydrate (`state.rehydrated=false; syncNow()`)
  → `state.touchedTaskIds` = {A,B,C}; chip-remove B → server {A,C}.
- Regression: `pytest`, `vitest`, `npm run e2e`.

## Risks

- Migration + endpoint rename. The `/assign` consolidation touches
  `test_taskless_block.py` and the frontend assign branch — both updated.
- `block.task_id` can be null (taskless active) — `active_task_id` is nullable.
