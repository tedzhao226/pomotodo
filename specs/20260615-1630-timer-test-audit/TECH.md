# Approach

Three test layers, all runnable in this environment:

- **Backend unit** — `pytest` over `backend/service.py` + `repository.py`
  via `tests/test_bucket.py`. Covers VAL-12 and counting invariants.
- **Frontend unit** — `vitest` (`tests/js/*.test.js`) for pure helpers/i18n.
  `app.js` is a classic script (no exports), so timer logic is not unit-
  testable there; it is covered by the e2e layer instead.
- **Browser e2e** — `tests/e2e_timer.js`, a self-contained async script
  evaluated in-page against a clean test server. Covers VAL-1..11, 13. Run
  via the cmux browser pane (`eval`), not browser-harness.

## Plan

1. Codex audit (read-only) → coverage matrix + gaps + redundancy + test
   bugs. Saved under `runs/audit/`.
2. Streamline + extend:
   - `tests/e2e_timer.js`: add VAL-7 (pause/resume), VAL-10 (auto-start),
     VAL-11 (long break) and any gaps the audit finds; remove redundant
     assertions; keep one async report.
   - `tests/test_bucket.py`: add VAL-12 edge cases (dedupe ids, unknown
     block) if missing.
   - Remove stale browser-harness tests the audit flags as broken.
3. Verify all green.

## Tests / verification commands

```sh
# backend
uv run pytest -q
# frontend unit
npm test
# e2e: clean throwaway server, then eval the script in the cmux browser pane
rm -f /tmp/pomo_test.db
POMOTODO_DATABASE_URL="sqlite:////tmp/pomo_test.db" uv run alembic upgrade head
POMOTODO_DATABASE_URL="sqlite:////tmp/pomo_test.db" uv run uvicorn backend.main:app --port 8731 &
# point the cmux browser at http://localhost:8731 then:
#   SCRIPT=$(cat tests/e2e_timer.js); cmux browser eval --surface <id> "$SCRIPT"
# expect {"passed":N,"failedCount":0}
```

Acceptance met when pytest + vitest pass and `e2e_timer.js` reports
`failedCount: 0` with assertions for every VAL-*.
