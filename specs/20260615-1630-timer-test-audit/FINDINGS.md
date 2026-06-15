# Findings

Codex audit (read-only): `runs/audit/codex-report.md`. Coverage matrix
flagged MISSING pause/resume + auto-start; PARTIAL restart, completion,
abort, backend; plus stale browser-harness tests and a few test bugs.

## Execution Log

- T1 Codex audit complete → report saved to `runs/audit/`.
- T2 `tests/e2e_timer.js` rewritten: deterministic settings, condition-based
  waits (no fixed sleeps), and full VAL coverage — added pause/resume,
  long-break, auto-start (rest + next pomodoro), skip-abort, exact touched
  set on restart, and "all boxes checked by default". 52 assertions.
- T3 `tests/test_bucket.py`: added credit dedupe + unknown-block cases (29
  backend tests).
- T4 Removed stale browser-harness timer tests: `bh_history.py` (timer
  completion now uses the credit modal), plus `bh_timer_counts.py` /
  `bh_block_switch.py` earlier. Non-timer bh tests
  (buckets/task_crud/i18n_notes) left as legacy.
- App fix found while hardening: `resumeTimer` called `runTicker` without
  clearing, risking a duplicate interval; made `runTicker` self-clear.
- T5 Verify: `uv run pytest -q` 29 passed; `npm test` 12 passed;
  `e2e_timer.js` → `{"passed":52,"failedCount":0}` against a clean
  sqlite test server via cmux browser eval.
