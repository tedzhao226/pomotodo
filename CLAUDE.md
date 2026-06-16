# Pomotodo — Project Guidelines

## Testing

Three layers, all runnable locally:

- **Backend unit** — `uv run pytest -q` (`tests/test_*.py` over `backend/`).
- **Frontend unit** — `npm test` (vitest, `tests/js/*.test.js`; pure helpers/i18n only — `app.js` is a classic script with no exports).
- **Browser e2e (full testing)** — drive the real DOM/state against a live server.

### Full testing: use the cmux browser harness

For full end-to-end browser testing, use the **cmux browser harness** (in-page `cmux browser eval`).

The e2e scripts are `tests/e2e_*.js` (`e2e_timer`, `e2e_task_crud`, `e2e_buckets`, `e2e_i18n_notes`): each a self-contained async script that drives the real app and returns `{ passed, failedCount, failed }`.

Run it against a clean throwaway server:

```sh
rm -f /tmp/pomo_test.db
POMOTODO_DATABASE_URL="sqlite:////tmp/pomo_test.db" uv run alembic upgrade head
POMOTODO_DATABASE_URL="sqlite:////tmp/pomo_test.db" uv run uvicorn backend.main:app --port 8731 &
# point the cmux browser at http://localhost:8731, then:
SCRIPT=$(cat tests/e2e_timer.js); cmux browser eval --surface <id> "$SCRIPT"
# the run takes ~20s; cmux eval resolves first, so the report is also on window.__e2e:
#   cmux browser wait --surface <id> --function "window.__e2e!==null"
# expect {"passed":N,"failedCount":0}
```

New e2e scripts should follow the `tests/e2e_timer.js` pattern: deterministic
settings, condition waits (not fixed sleeps), one JSON report, and stash the
result on `window.__e2e` for `cmux browser wait`.
