# Today / Backlog + Click-to-Filter Tags — Tech Spec

Product spec: specs/20260613-2016-today-backlog-tags/PRODUCT.md

## Problem

Backlog membership must survive reloads and live at the data layer, so it is a
task column rather than client state.
The planned sum and the two sub-lists must derive from the existing dashboard
payload without a new endpoint.
Removing the filter panel must not break the click-a-tag filtering that already
works from row chips.

## Relevant Code

- `app/db.py:18-56` — `init_schema`; tasks table plus the `blocks_override`
  migration pattern to copy for the new column.
- `app/repository.py:20-29` — `_task_row_to_dict`; the place every task dict is
  built.
- `app/repository.py:31-55` — `create_task`; relies on column defaults for unset
  fields.
- `app/repository.py:84-97` — `update_task`; already generic over a `fields` dict.
- `app/service.py:21-49` — `update_task`; per-field validation.
- `app/service.py:74-107` — `get_dashboard`; assembles each dashboard task.
- `app/schemas.py:19-23` — `UpdateTaskRequest`.
- `app/schemas.py:50-59` — `DashboardTask`.
- `app/api.py:67-85` — `update_task` route.
- `static/index.html:67-70` — `#filter-panel` (remove).
- `static/index.html:72-91` — Todos panel and `#task-list`.
- `static/app.js:306-329` — `renderTagChips` (remove).
- `static/app.js:347-367` — `rowHtml`.
- `static/app.js:409-444` — `renderTaskList`.
- `static/app.js:973-1067` — task-list click handler.
- `static/app.js:1071-1120` — drag-to-reorder logic.

## Current State

Tasks have no bucket; the single `#task-list` renders every task in local order,
optionally filtered by `state.selectedTag`.
The "Filter by tag" panel (`#filter-panel` + `#tag-chips`) renders an `All` chip
plus one chip per tag via `renderTagChips`, which sets `state.selectedTag`.
Row tag chips already filter via `data-action="filter"`.
`update_task` updates an arbitrary `fields` dict, so adding a column needs only
service-level validation and schema wiring.

## Implementation

### Backend — add `bucket` (`'today'` | `'backlog'`, default `'today'`)

- `db.py`: add `bucket TEXT NOT NULL DEFAULT 'today'` to the `CREATE TABLE tasks`
  statement, and add a guarded
  `ALTER TABLE tasks ADD COLUMN bucket TEXT NOT NULL DEFAULT 'today'` beside the
  `blocks_override` migration, using the same `columns` membership check.
- `repository.py`: include `"bucket": row["bucket"]` in `_task_row_to_dict`.
  `create_task` needs no change (the column default applies); `update_task` is
  already generic.
- `service.py`: `update_task` gains `bucket: str | None = None`; when provided,
  validate `bucket in {"today", "backlog"}` (else raise `ValueError`) and set
  `fields["bucket"]`.
  `get_dashboard` adds `"bucket": task["bucket"]` to each dashboard task.
- `schemas.py`: `UpdateTaskRequest` adds
  `bucket: Literal["today", "backlog"] | None = None`; `DashboardTask` adds
  `bucket: str`.
- `api.py`: pass `bucket=body.bucket` into `service.update_task`.

### Frontend

- `index.html`: delete the `#filter-panel` section.
  In the Todos panel after the add-form and hint, add a hidden filter indicator
  (`#filter-indicator`) and two headed sub-lists:
  `Today <span id="planned-sum">` over `<ul id="today-list">`, and `Backlog` over
  `<ul id="backlog-list">`.
- `app.js`:
  - Remove `renderTagChips` and its call in `renderDashboard`; drop `els.tagChips`.
  - Add els: `todayList`, `backlogList`, `plannedSum`, `filterIndicator`.
  - `renderTaskList`: from `orderedTasks()`, split by `task.bucket`; within each
    bucket apply the `selectedTag` filter and render rows into the matching `<ul>`.
    Compute the planned sum from all `bucket === "today"` tasks (before the tag
    filter) and write `Planned: N blocks`.
    Render an empty-state line into a bucket that has no visible rows.
  - Filter indicator: when `state.selectedTag` is set, show `Showing #tag ✕` and
    clear the filter on click.
    Clicking the already-active tag chip also clears it.
  - `rowHtml`: add a move button — Today rows carry
    `data-action="move" data-bucket="backlog"` (`→ Backlog`); Backlog rows carry
    `data-bucket="today"` (`→ Today`).
  - Click handler: on `move`, optimistically set `task.bucket = target`,
    `renderAll()`, then `PATCH /api/tasks/{id}` with `{bucket}` and
    `scheduleSync()`.
  - Drag: scope the listeners and `finishDrag` to `#today-list`; only Today rows
    get `draggable`.
    `canDrag` stays `!state.selectedTag && state.editingTaskId === null`.

## Edge Cases

- A task with no estimate contributes 0 to the planned sum.
- An active tag filter does not change the planned sum (it counts all Today tasks).
- An empty bucket shows a short empty-state line.
- A selected or running task moved to Backlog stays selected and runnable; only its
  list changes.
- The local order list (`pomotodo.taskOrder`) stays one flat list; buckets filter
  the same order.

## Tests

- `tests/`: add backend coverage that creating a task defaults `bucket == "today"`;
  `update_task(bucket="backlog")` persists and surfaces through `get_dashboard`; an
  invalid bucket raises `ValueError`; the migration adds the column to a
  pre-existing DB.
- Verify: `uv run pytest`.
- Manual: `uv run uvicorn app.main:app` — add a todo, move it to Backlog and back,
  click a tag to filter then clear, and confirm `Planned: N blocks` matches the sum
  of Today estimates.
