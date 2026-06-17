# Pomotodo — Project Guidelines

## Testing

Three layers, all runnable locally:

- **Backend unit** — `uv run pytest -q` (`tests/test_*.py` over `backend/`).
- **Frontend unit** — `npm test` (vitest, `tests/js/*.test.js`; pure helpers/i18n only — `app.js` is a classic script with no exports).
- **Browser e2e (full testing)** — drive the real DOM/state against a live server.

### Full testing: use the cmux browser harness

For full end-to-end browser testing, use the **cmux browser harness** (in-page `cmux browser eval`).

The e2e scripts are `tests/e2e_*.js` (`e2e_timer`, `e2e_task_crud`, `e2e_buckets`, `e2e_i18n_notes`, `e2e_history_delete`): each a self-contained async script that drives the real app and returns `{ passed, failedCount, failed }`.

Run it against a clean throwaway server:

```sh
rm -f /tmp/pomo_test.db
POMOTODO_DATABASE_URL="sqlite:////tmp/pomo_test.db" uv run alembic upgrade head
POMOTODO_DATABASE_URL="sqlite:////tmp/pomo_test.db" uv run uvicorn backend.main:app --port 8731 &
# Open a browser surface and CAPTURE ITS ID (open reuses an existing panel, so
# never assume; always read the returned id):
SID=$(cmux browser open http://localhost:8731 | grep -oE "surface:[0-9]+" | head -1)
SCRIPT=$(cat tests/e2e_timer.js); cmux browser eval --surface "$SID" "$SCRIPT"
# the run takes ~20s; poll the report via eval (see gotcha below):
#   cmux browser eval --surface "$SID" "window.__e2e ? JSON.stringify(window.__e2e) : 'pending'"
# expect {"passed":N,"failedCount":0}
```

**Always close the surface you opened when the run is done** — leave no orphan
browser panels:

```sh
cmux close-surface --surface "$SID"   # close ONLY the captured id, never a blind/other tab
pkill -f "uvicorn backend.main:app --port 8731"   # and stop the throwaway server
```

Harness gotchas (learned the hard way):

- Use a **fresh DB per run** (each script seeds its own tasks; a reused DB
  accumulates rows and corrupts later runs).
- Read the report with `cmux browser eval`, **not** `cmux browser wait --function`
  — `wait` runs in an isolated world that can't see `state` or `window.__e2e`.
- After `goto`/`open`, settle ~3s before evaluating (app globals aren't ready
  immediately).

New e2e scripts should follow the `tests/e2e_timer.js` pattern: deterministic
settings, condition waits (not fixed sleeps), one JSON report, and stash the
result on `window.__e2e`.
