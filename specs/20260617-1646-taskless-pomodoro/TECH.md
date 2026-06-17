# Taskless Pomodoro + Pin Tasks — Approach

## Part A — Taskless pomodoro

### Data model

Make `Block.task_id` **nullable** so a work session can exist before attribution.

- `backend/models.py` — `Block.task_id: Mapped[int | None]` (FK stays; `nullable=True`).
- `alembic/versions/0008_block_task_nullable.py` — `down_revision = "0007_drop_block_archived"`;
  alter `blocks.task_id` to nullable. SQLite test path uses `Base.metadata.create_all` so
  tests pick it up automatically; migration is for Postgres deploy.

No new tables. Existing `credit_block` already repoints `block.task_id` to
`task_ids[0]` when the anchor is absent from the checked set (repository.py:227-228).

### Backend flow

#### New route

- `POST /api/blocks` — body `{ duration_min: int }` → creates a block with
  `task_id=None`, returns `BlockStartResponse` with `task_id: int | None`.
- Keep `POST /api/tasks/{task_id}/blocks` unchanged for task-anchored starts.

#### Service / repository touch-ups

- `Repository.create_block(task_id: int | None, duration_min: int)` — accept `None`.
- `Service.start_unanchored_block(duration_min)` — validate duration, call create.
- `get_running_block()` — when `block.task_id is None`, return `task_id: null`,
  `task_name: ""` (don't dereference `block.task`).
- `_block_to_dict()` — null-safe `task_name` / `tags` when `block.task_id is None`.

#### Schemas

- `BlockStartResponse.task_id: int | None`

### Frontend flow (taskless)

All in `frontend/app.js` unless noted.

- Remove `!selected` from pomodoro idle disabled guard.
- `startPomodoro`: allow null taskId.
- `startBlock`: branch to `POST /api/blocks` when no task; empty touched set.
- Taskless-started blocks: credit modal = Today non-done tasks; pre-check touched subset.
- Task-selected blocks: unchanged (touched list, all checked).
- `credit.titleUntethered` EN+ZH for taskless completion title.

### Tests (taskless)

- `tests/test_taskless_block.py` — pytest for unanchored start + credit.
- `tests/e2e_timer.js` — VAL-FREE-001..006; update VAL-1.

---

## Part B — Pin to top

**No backend changes.** Reuse `PATCH /api/tasks/order` (`ReorderRequest`: bucket +
full `task_ids` list). The service validates every id belongs to the bucket
(`service.py:78-87`).

### Frontend

#### UI (`frontend/app.js` `rowHtml`)

- Add pin button before `row-move`:
  ```html
  <button type="button" class="row-pin" data-action="pin" data-id="…" title="…">📌</button>
  ```
  Use a text glyph (e.g. `↑` or `📌`) consistent with existing row icons; no new assets.

- Disable pin when `state.selectedTag` is set (pass flag into `rowHtml` or read
  global state). Optionally hide when task is already first in bucket.

#### Handler (`handleTaskClick`, action `pin`)

```pseudo
pinTask(taskId):
  task = find task by id; bucket = task.bucket
  if state.selectedTag: return
  ordered = tasksInBucket(bucket).map(t => t.id)
  if ordered[0] === taskId: return  // already top
  newOrder = [taskId, ...ordered.filter(id => id !== taskId)]
  // optimistic sort_order update on state.dashboard.tasks (mirror finishDrag)
  renderAll()
  await PATCH /api/tasks/order { bucket, task_ids: newOrder }
  await syncNow()
```

Works for **both** Today and Backlog (Backlog has no drag, but pin is useful there too).

#### Styles (`frontend/style.css`)

- `.row-pin` — match `.row-edit` / `.row-move` sizing (24×24).
- Widen `.task-row:hover .row-actions` width to fit the extra button (~140px).

#### i18n (`frontend/i18n.js`)

- `row.pin` — "Pin to top" / "置顶" (EN + ZH).

### Tests (pin)

- `tests/e2e_buckets.js` — add `VAL-PIN` block after reorder tests:
  - pin second task → DOM order flips
  - `syncNow()` → order holds
  - activate tag filter → pin disabled
- No new pytest (reorder API already covered).

---

## Verification

```bash
pytest -q && npm test
SCRIPT=$(cat tests/e2e_timer.js); cmux browser eval --surface <id> "$SCRIPT"
SCRIPT=$(cat tests/e2e_buckets.js); cmux browser eval --surface <id> "$SCRIPT"
```

## Risks / notes

- **Taskless**: crediting zero tasks completes the block with no `blocks_done` bump
  (existing credit API allows empty `task_ids` — confirm in B2 test).
- **Pin + filter**: pin must use the **full** bucket list from `tasksInBucket`, not
  the filtered DOM subset (contrast `finishDrag`, which only sends visible ids — a
  pre-existing quirk when filtered; pin must not repeat that bug).
- **Pin + drag**: both mutate `sort_order`; last action wins — acceptable.
