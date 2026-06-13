# Pomotodo — Handoff

State of the repo and what's left, for the next session. See `PRODUCT.md` / `TECH.md` for
spec. Implementation history lives in `~/.claude/plans/1-make-it-humming-horizon.md` and the
initial commit `59b4715`.

## Current state — done & working

- Layered FastAPI app (Router/Service/Repository) + SQLite; vanilla-JS frontend, no build.
- Todos: add (`#tag`/`*N`), inline edit (name/done/estimate), tag-click filter, status
  toggle, **delete** + **clear-completed**, **drag reorder** (frontend-only, localStorage).
- Timer: blocks with start/end records, **pause/resume**, **resume-on-reload**, work/rest
  cycle, WebAudio chime on block + rest end.
- Statistics: KPIs (total / daily avg / monthly change) + SVG trend / Top Tags / Best
  Worktime. Mini cards on Main. Settings page (localStorage).
- Frontend **buffer + debounced sync** (15s reconcile, optimistic mutations, local tag
  filtering).
- UI restyled 1-to-1 with the reference screenshot (light theme, `Maple Mono NF`, hairline
  cards). OD design reference: project `pomotodo-redesign`.
- Verified each step: `uv run pytest -q` (9 parser tests green), `node --check` on app.js,
  and live concurrent requests after the threadpool fix.

## Known caveats

- Task order and settings are **per-browser** (localStorage); not synced server-side.
- Drag reorder is enabled only when the list is unfiltered (order is a single global list).
- Only automated tests are `tests/test_parser.py`. No service/API or frontend tests.
- `static/app.js` is a single large file (~1000 lines); no module split.
- `pomotodo.db` is gitignored — fresh clones start empty (schema auto-created on startup).

## Recently fixed (watch for regressions)

- `sqlite3.ProgrammingError: SQLite objects created in a thread...` on concurrent
  `dashboard`+`stats`. Fixed with `check_same_thread=False` in `db.py` (per-request
  connections, safe). The `syncNow` `Promise.all` is what made it concurrent.

## Backlog — not yet implemented (priority order)

1. **Offline mutation queue** — buffer/sync layer already exists; queue mutations in
   localStorage when offline, flush on reconnect → true local-first.
2. **Browser notification + tab-title countdown** on block/rest end (beyond the chime).
3. **Pin tasks to top** (the red pin in the reference) — cheap now that order is client-side.
4. Per-pomo **interruption counter**; "auto-start next pomo" / strict mode.
5. **Due dates** + Today/Overdue grouping; estimate-vs-done overflow flag on rows.
6. Daily **heatmap + streaks** on Statistics.
7. **Edit/delete individual pomo blocks** (history correction).
8. **Export** CSV/JSON; tag color customization (legend already color-codes).
9. **PWA** (installable + offline) — pairs with #1.
10. **Keyboard shortcuts** (space = start/pause, `n` = new todo).
11. Server-side persistence of settings + order, eventually multi-user (currently none).

## Suggested skills for next session

- `design` — for any further visual/1-to-1 polish (screenshot-grounded iteration).
- `cmux-workspace` — to read the live `uvicorn --reload` pane when debugging runtime errors.
- `testing` — to add the missing service/API test coverage.
- Open Design MCP (`mcp__open-design__*`) — iterate the look in project `pomotodo-redesign`.

## Run / verify

```
uv run uvicorn app.main:app --reload   # http://127.0.0.1:8000
uv run pytest -q
node --check static/app.js
```
