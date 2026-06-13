# Pomotodo — Tech Spec

## Stack

FastAPI + SQLite (stdlib `sqlite3`), Pydantic schemas, vanilla JS/CSS (no build step, no
frontend deps). Managed with `uv`. Layered: Router → Service → Repository.

## Layout

```
app/
  main.py        # FastAPI app, lifespan (init_schema), static mount, GET /
  api.py         # routers (thin), DI: get_db → Repository → Service
  service.py     # business logic (Service)
  repository.py  # SQLite data access (Repository)
  schemas.py     # Pydantic request/response models
  db.py          # connection + schema/migrations
  parser.py      # parse_raw("text #tag *N") -> (name, tags, estimate)
static/
  index.html     # 3 views + header tabs
  app.js         # state buffer, sync, timer, charts, all UI logic
  style.css      # theme (Maple Mono NF, light, hairline cards)
tests/test_parser.py   # only automated tests (parser)
```

## Data model (`db.py`)

- `tasks(id, name, estimate_blocks, blocks_override, status, created_at)`
- `task_tags(task_id, tag)` PK(task_id, tag)
- `blocks(id, task_id, duration_min, started_at, ended_at, completed)`

`blocks_override` (nullable) is a manual override of the done-block count; when null the
dashboard uses the computed count of completed blocks. There is **no** order/position
column — task order lives only in the frontend (localStorage). Migrations are idempotent
`ALTER TABLE` guards in `init_schema` keyed off `PRAGMA table_info`.

## API

- `POST /api/tasks` `{raw}` → parse + create
- `GET /api/tasks?tag=` → list
- `PATCH /api/tasks/{id}` `{name?, estimate_blocks?, blocks_done?, status?}` (400 bad value,
  404 missing; `blocks_done` maps to `blocks_override`)
- `POST /api/tasks/clear-completed` → `{deleted: n}`
- `DELETE /api/tasks/{id}` → 204 (cascades blocks+tags), 404 missing
- `POST /api/tasks/{id}/blocks` `{duration_min}` → start a block
- `PATCH /api/blocks/{id}` `{completed}` → end a block
- `GET /api/dashboard` → tasks (+ blocks_done/total_minutes/start/end), running_block, tags
- `GET /api/stats` → last-90-day completed blocks (+task name/tags), all-time counts, tags
- `GET /` → static index

## Frontend architecture (`static/app.js`)

- **Buffer + sync**: `state.dashboard` / `state.stats` are the render source.
  `syncNow()` does a single combined `Promise.all([dashboard, stats])` fetch + render;
  `scheduleSync()` debounces it (600ms); background reconcile every `SYNC_MS` (15s).
  Mutations update the buffer optimistically and `renderAll()` immediately; tag filtering
  is pure client-side off the buffer (no fetch).
- **Client-only task order**: `state.order` persisted at `localStorage` key
  `pomotodo.taskOrder`; `orderedTasks()` sorts the buffer, new ids float to top, deleted
  ids pruned. Drag-reorder rewrites the order locally; never hits the backend. Drag is
  enabled only when unfiltered.
- **Settings**: `localStorage` key `pomotodo.settings`
  `{dailyGoal, defaultDuration, shortRest, longRest, longEvery}`.
- **Timer**: `startCountdown/runTicker` with stored `onComplete`; `pauseTimer/resumeTimer`;
  `maybeRehydrateTimer()` resumes a server-side `running_block` on first sync (remaining =
  duration − elapsed; auto-finishes if overran). Chime via WebAudio (`playChime`).
- **Charts**: hand-rolled SVG (`svgLine`, `svgBars`, `svgPie`), no library. All day/hour
  bucketing done client-side in local timezone (blocks store UTC ISO).

## Key decisions / gotchas

- `db.py get_connection()` uses `check_same_thread=False`: FastAPI runs sync endpoints and
  the `get_db` generator in threadpool workers, so a per-request connection may be opened
  and closed on different threads. Connections are never shared between requests, so this is
  safe. (This was a real crash on concurrent `dashboard`+`stats` — see HANDOFF.)
- Font `"Maple Mono NF"` is resolved from the user's local install (matches their Ghostty
  font); no web-font/CDN dependency.
- Design reference built in Open Design project `pomotodo-redesign` (preview served by the
  local OD daemon) — not part of the app runtime.

## Run / verify

```
uv run uvicorn app.main:app --reload      # http://127.0.0.1:8000
uv run pytest -q                           # parser tests
node --check static/app.js                 # JS syntax
```
