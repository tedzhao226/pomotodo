# Findings: Cross-Device Break Sync

## Relevant Files

- `backend/models.py` — add `BreakState` singleton; `Block` is task-anchored
  (FK NOT NULL) so it can't hold a break.
- `backend/schemas.py` — `DashboardResponse` (94) gets `break_state`; mirror the
  `RunningBlock` (80) pattern for `BreakStateOut`.
- `backend/repository.py` / `service.py` — add set/clear/get break; `get_break`
  lazy-expires. Wire into `get_dashboard` (service.py:125) next to
  `get_running_block`.
- `backend/api.py` — add `PUT`/`DELETE /api/break`; credit/dashboard routes are
  the nearby pattern.
- `alembic/versions/0004_block_note.py` — template + current head for `0005`.
- `frontend/app.js` — supersede the localStorage break path: `BREAK_KEY`,
  `persistBreak` (~290), `maybeRehydrateBreak`, and the `state.rehydrated` guard
  (added only to protect the localStorage key). `maybeRehydrateTimer` (~700)
  prefers `running_block`; swap its break branch to read `dashboard.break_state`.
  `renderTimer` is the write chokepoint (hosted `persistBreak`).
- `tests/e2e_timer.js` — current `VAL-BRK` block is localStorage-based; rework to
  `VAL-BSYNC` (server) — same scenarios, server assertions.

## Discoveries

- Backend is global single-tenant (no per-user scoping; `get_running_block` is a
  global "the open block"). So cross-device already works for pomodoro because
  state is shared; the break is the only device-local piece. Server break state
  closes the gap with the same global model.
- Reads ride the existing dashboard poll (`syncNow` every ~15s + on load), so no
  new read endpoint and no websockets for on-open pickup. Writes are
  transition-only (diff-guarded) to avoid per-tick network calls.
- `maybeRehydrateTimer` runs once on the first post-load sync — enough for
  on-open pickup, but it means a device already open won't adopt a break started
  elsewhere until reload (live push is out of scope).

## Knowledge Updates

- Break state becomes server-owned; localStorage break-persist (spec
  20260616-1250) is retired in favor of the server as single source of truth.

## Drift

- None vs the (now concrete) requirement: cross-device break continuity on open.
  Scoping decision recorded: on-open pickup IN, live mid-session push OUT.

## Durable Candidates

- None yet.

## Execution Log

Append-only. One entry per status transition.

### [2026-06-16 18:20] B1 — halted before terminal (no status change; stays pending)

- status: pending (B1 dispatch backed out; not in_progress)
- backend: claude
- reason: a parallel feature `specs/20260616-1700-pomo-dedup-soft-delete/` is
  uncommitted and shares this spec's backend write-set (api/repository/service/
  schemas/models) and owns alembic head `0005_block_archived`. User halted exec
  until that feature is committed; will re-trigger.
- action taken: reverted the only B1 edits made (backend/models.py BigInteger
  import + BreakState class). Worktree left clean for the parallel commit —
  models.py now differs from HEAD only by the parallel feature's `Block.archived`.
- **RESUME REQUIREMENTS** (apply when re-triggered, after the parallel commit):
  1. Migration: do NOT use `0005`. New head will be `0005_block_archived`; create
     `alembic/versions/0006_break_state.py` with `down_revision =
     "0005_block_archived"`. Update TASKS B1 write_set + TECH accordingly.
  2. Re-base on the committed backend files (archived/soft-delete merged) before
     editing — re-read api.py/repository.py/service.py/schemas.py first.
  3. e2e `VAL-BRK→VAL-BSYNC` rework: confirm the soft-delete changes didn't move
     the credit/dashboard shapes the e2e relies on.

### [2026-06-16 18:40] B1 — resumed → done

- status: done
- backend: claude
- contract_refs: VAL-BSYNC-001, VAL-BSYNC-004, VAL-BSYNC-005
- tests_run: `pytest -q` → 40/40 (the earlier 72 included ~30 now-removed TUI
  test files; 40 is the current core suite, all green).
- evidence: `BreakState` singleton (id=1, mode, deadline_ms) + migration
  `0006_break_state` (down_revision `0005_block_archived` — soft-delete owns
  0005, still uncommitted in this worktree); repo `set_break`/`clear_break`/
  `get_break` (lazy-expire on past deadline); service passthrough +
  `dashboard.break_state`; `PUT`/`DELETE /api/break`; `SetBreakRequest`,
  `BreakStateOut`, `DashboardResponse.break_state`.
- note: backend files still carry the parallel soft-delete feature's uncommitted
  edits; break-sync layered on top. Clean commit needs soft-delete committed first.
- run_path: runs/B1/

### [2026-06-16 18:50] B2 — done

- status: done
- backend: claude
- contract_refs: VAL-BSYNC-001, VAL-BSYNC-004, VAL-BSYNC-005
- tests_run: `pytest -q tests/test_break_sync.py` → 3 passed.
- evidence: set→dashboard match; clear→null; past deadline→null (lazy-expire).
- run_path: runs/B2/

### [2026-06-16 18:50] F1 — done

- status: done
- backend: claude
- contract_refs: VAL-BSYNC-001..004
- tests_run: `npm test` → 12/12 (behavior verified in E1).
- evidence: `syncBreak()` (diff-guarded PUT/DELETE `/api/break`, fire-and-forget)
  replaces `persistBreak`; `maybeRehydrateBreak` reads `state.dashboard.break_state`
  (pomodoro `running_block` still preferred); all localStorage break code removed
  (`BREAK_KEY`, JSON read/write).
- drift from TECH: TECH said remove the `state.rehydrated` guard; KEPT it on
  `syncBreak` instead — without it a pre-rehydrate idle render would DELETE the
  server break, which is now cross-device-destructive (would wipe another
  device's running break). Correct safety, small deviation.
- run_path: runs/F1/

### [2026-06-16 18:55] E1 — done (after a self-inflicted bug + fix)

- status: done
- backend: claude
- contract_refs: VAL-BSYNC-001..004
- tests_run: full e2e via cmux on clean sqlite server → `{"passed":79,"failedCount":0}`
  (75 baseline + 4 VAL-BSYNC).
- bug found + fixed: the first VAL-BSYNC e2e crashed the *next* section (VAL-REC
  `boxB undefined`). Root cause traced (strip-test + step trace): VAL-BSYNC-002
  forces a rehydrate (`rehydrated=false`+`syncNow`) but a **stale open pomodoro
  block lingered server-side** from earlier sections → pomodoro won precedence,
  completed, and left a credit modal open that bled into VAL-REC. Fix: end any
  lingering server block at the top of the VAL-BSYNC section (the same pattern
  the e2e setup uses) so the "second device" rehydrate sees only the break.
- note: the break-sync FEATURE was correct throughout — all four behaviors
  passed in isolation on a clean DB; the failure was e2e sequencing.
- run_path: runs/E1/

### [2026-06-16 18:55] V1 — done (PASS)

- status: done (PASS)
- backend: claude
- contract_refs: VAL-BSYNC-001..006
- tests_run: `pytest -q` → 43 passed (incl. tests/test_break_sync.py 3); e2e
  `{"passed":79,"failedCount":0}`.
- evidence: 001/002/003/004 via e2e; 001/004/005 via pytest; 006 = both suites
  green. All acceptance ids satisfied.
- run_path: runs/V1/
