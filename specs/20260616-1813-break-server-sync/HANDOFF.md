# Handoff — Cross-Device Break Sync — 2026-06-16 18:56

## Goal

Store a running break on the server so opening the app on another device resumes
it; retire the localStorage break path.

## Shipped

- `backend/models.py` + `alembic/versions/0006_break_state.py` — `BreakState`
  singleton (id=1, mode, deadline_ms). Migration on head `0005_block_archived`.
- `backend/schemas.py` — `SetBreakRequest`, `BreakStateOut`,
  `DashboardResponse.break_state`.
- `backend/repository.py` — `set_break`/`clear_break`/`get_break` (lazy-expire on
  past deadline).
- `backend/service.py` — passthroughs + `get_dashboard().break_state`.
- `backend/api.py` — `PUT`/`DELETE /api/break`.
- `frontend/app.js` — `syncBreak()` (diff-guarded PUT/DELETE, fire-and-forget)
  replaces `persistBreak`; `maybeRehydrateBreak` reads `dashboard.break_state`;
  all localStorage break code removed.
- `tests/test_break_sync.py`, `tests/e2e_timer.js` (VAL-BRK → VAL-BSYNC).

## Acceptance

```text
tasks[5]{id,title,contract_refs,result}:
  B1,Backend BreakState + /api/break + dashboard,"VAL-BSYNC-001,004,005",done
  B2,Pytest set/clear/expire,"VAL-BSYNC-001,004,005",done
  F1,Frontend server sync + rehydrate,"VAL-BSYNC-001..004",done
  E1,e2e VAL-BSYNC,"VAL-BSYNC-001..004",done
  V1,Validate,"VAL-BSYNC-001..006",done
```

- VAL-BSYNC-001 break synced to server — pass.
- VAL-BSYNC-002 second device resumes on open — pass.
- VAL-BSYNC-003 pomodoro wins over break — pass.
- VAL-BSYNC-004 cleared on pomodoro/end — pass.
- VAL-BSYNC-005 expired break reads null — pass (pytest).
- VAL-BSYNC-006 no regression — pass (pytest 43/43, e2e 79/0).

## Verification

- [x] `pytest -q` → 43 passed (incl. test_break_sync).
- [x] `npm test` → 12/12.
- [x] e2e on clean sqlite server → `{"passed":79,"failedCount":0}`.

## Scope / notes

- On-open pickup only (rides the dashboard sync). **Live mid-session push is out
  of scope** — a device already open won't adopt a break started elsewhere until
  it reloads.
- Global single-tenant: break state follows `running_block`'s global model; scope
  per-user when auth lands.
- `syncBreak` keeps the `state.rehydrated` guard (deviation from TECH) so a
  pre-rehydrate idle render can't DELETE another device's break.

## Follow-ups / commit

- **Uncommitted, entangled.** This sits on top of the still-uncommitted parallel
  `specs/20260616-1700-pomo-dedup-soft-delete/` work (shared backend files,
  alembic head `0005_block_archived`). A clean commit needs that feature
  committed first. Migration here is `0006` (down_revision `0005_block_archived`).

## Context

- Branch: master
- Spec: /Users/ted/workspace/pomotodo/specs/20260616-1813-break-server-sync
- Working directory: /Users/ted/workspace/pomotodo
