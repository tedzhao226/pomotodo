# Finished Task Sinks to Bottom — Approach

Ordering is server-authoritative (`Task.sort_order` per bucket). The backend re-homes a task to
the bottom of its bucket on the done-transition; the frontend mirrors it optimistically. No new
endpoints, schema, or migration.

## Backend — re-home on the done-transition

File: `backend/repository.py`, `Repository.update_task` (currently lines 78-89).

Today it re-homes only on a bucket change:

```python
if "bucket" in fields and fields["bucket"] != task.bucket:
    task.sort_order = self._next_sort_order(fields["bucket"])
```

Replace that single `if` with bucket-OR-finishing re-homing, computing the target bucket once so
a simultaneous bucket+done change re-homes to the new bucket exactly once:

```python
target_bucket = fields.get("bucket", task.bucket)
bucket_changed = "bucket" in fields and fields["bucket"] != task.bucket
# Finishing a task sinks it below the still-active tasks in its bucket.
finishing = fields.get("status") == "done" and task.status != "done"
if bucket_changed or finishing:
    task.sort_order = self._next_sort_order(target_bucket)
```

Keep the existing `for column, value in fields.items(): setattr(...)` loop and `flush()` after
this block. `_next_sort_order` (lines 31-35) MUST run before `setattr` mutates `task.bucket` /
`task.status`, identical to the current ordering.

Edge cases (all covered by the guard, no extra code):

- `status=done` on an already-done task → `finishing` False → no bump (idempotent).
- PATCH without a `status` key → `fields.get("status")` is None → no re-home.
- done→active reopen → not done → `sort_order` untouched (stays at bottom).
- same-bucket finish → the task is included in `_next_sort_order`'s max, so `max+1` lands it last.

No `backend/service.py` change: `Service.update_task` already forwards `status` into `fields`.

## Frontend — optimistic mirror

File: `frontend/app.js`, `handleTaskClick` `action === "toggle"` branch (currently lines
1974-1986). Inside the existing `if (task) { ... }` block, after `task.status = newStatus;` and
before `renderAll();`, add a bottom placement only when finishing:

```js
if (newStatus === "done") {
  // Mirror the server re-home so the row sinks at once, before scheduleSync reconciles.
  const maxOrder = Math.max(
    -1,
    ...state.dashboard.tasks
      .filter((t) => t.bucket === task.bucket)
      .map((t) => t.sort_order),
  );
  task.sort_order = maxOrder + 1;
}
```

`tasksInBucket` (lines 594-600) re-sorts on `renderAll()`, so the row drops to the bottom
immediately. The awaited PATCH persists the authoritative value; `scheduleSync()` reconciles
(server and optimistic agree on "last"; server wins on conflict). The reopen (`active`) path is
left unchanged. Use exact `t.bucket === task.bucket` to match the backend's per-bucket
`sort_order` namespace (`_next_sort_order` filters `Task.bucket == bucket`).

## Tests

### Backend (`tests/test_bucket.py`)

Append after `test_dashboard_orders_today_by_sort_order` (line 235), reusing the existing
`service` fixture:

```python
def test_completing_task_sinks_to_bottom(service):
    a = service.create_task_from_raw("a")  # sort_order 0
    b = service.create_task_from_raw("b")  # 1
    c = service.create_task_from_raw("c")  # 2
    done = service.update_task(a["id"], status="done")
    assert done["sort_order"] == 3  # below b and c
    today = [t for t in service.get_dashboard()["tasks"] if t["bucket"] == "today"]
    assert [t["id"] for t in today] == [b["id"], c["id"], a["id"]]
def test_reopening_task_keeps_bottom_position(service):
    a = service.create_task_from_raw("a")  # 0
    service.create_task_from_raw("b")      # 1
    service.update_task(a["id"], status="done")        # a -> sort_order 2
    reopened = service.update_task(a["id"], status="active")
    assert reopened["sort_order"] == 2  # not restored to its original slot
```

### Frontend e2e (`tests/e2e_task_crud.js`)

Add a self-contained block just before the final report assembly (before the `const passed = ...`
line, ~line 111). Reuse the file's existing helpers (`inToday`, `rowId`, `statusOf`, `action`,
`waitFor`, `input`). Pseudo-code:

```
add two fresh tasks SA then SB via the form, wait until both appear
saId = rowId(SA)
orderIds = () => [...#today-list .task-row].map(r => Number(r.dataset.id))
action(saId, "toggle")                          // mark SA done
waitFor(statusOf(saId) === "done")
waitFor(orderIds()[orderIds().length - 1] === saId)   // SA is now the last row
check("sink: done task moves to bottom of Today",
      orderIds()[orderIds().length - 1] === saId)
action(saId, "delete"); action(rowId(SB), "delete")   // cleanup
```

SA is created before SB, so SA starts above SB; after completion SA must be the bottom row
overall (the optimistic mirror sets `sort_order = max+1`, strictly greater than every existing
task, including any seeded done tasks). No vitest change — the change is DOM ordering, covered by
e2e.

## Verification

```bash
uv run pytest -q
npm test
SCRIPT=$(cat tests/e2e_task_crud.js); cmux browser eval --surface <id> "$SCRIPT"
```

## Risks / notes

- Optimistic `maxOrder + 1` may differ numerically from the server value under concurrent edits,
  but both keep the task last; the awaited PATCH + sync reconcile to the server value.
- The e2e order check must read after the optimistic `renderAll`; `waitFor(statusOf === "done")`
  plus `waitFor(last row === saId)` guards the timing.
