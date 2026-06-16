# Cross-Device Break Sync

## Intent

A running break is currently persisted only in the browser's localStorage
(`pomotodo.break`), so it survives a refresh on the **same** device but does not
follow the user to another device. A pomodoro already syncs everywhere because it
lives server-side (the global `running_block`). Make the break symmetric: store
the running break on the server so opening the app on a second device picks it up
and resumes it, exactly as pomodoro does today.

This **supersedes** the localStorage break-persist (spec 20260616-1250): the
server becomes the single source of truth for a running break, and the
localStorage path is removed.

## Behavior

- When a break (short/long) is running, its `{mode, deadline}` is stored on the
  server (singleton — the app is global single-tenant, like `running_block`).
- Opening / loading the app on any device with no running pomodoro block resumes
  the server's running break, computing remaining from the absolute deadline.
- A running pomodoro block still wins: if the server reports a `running_block`,
  that is rehydrated and the break is ignored.
- The break is cleared on the server when it ends, is skipped, a pomodoro starts,
  or it is paused (a paused break is not persisted — matching pomodoro pause).
- An expired break (deadline already past) is treated as none.

## Scope

- **In:** pick-up on app open/load, via the existing dashboard sync (the same
  ~15s poll + on-load fetch that carries `running_block`).
- **Out:** live mid-session push (a device already open instantly reflecting a
  break started elsewhere) — that needs continuous reconciliation / websockets.
  Out of scope; revisit if wanted.
- **Out:** per-user scoping — the timer is global single-tenant today; break
  state follows the same global model as `running_block` and will be scoped with
  it when auth lands.

## Acceptance

### VAL-BSYNC-001: Starting a break writes server break state
Given a short/long break starts running.
When the client syncs.
Then the server holds that break's `{mode, deadline}` and `GET /api/dashboard`
returns it as `break_state`.
Evidence: pytest tests/test_break_sync.py::test_set_and_read_break + e2e "VAL-BSYNC-001"

### VAL-BSYNC-002: Second device resumes the break on open
Given the server has a running break and no running pomodoro block.
When a freshly-loaded client runs its first sync + rehydrate.
Then `state.timerMode` is the break mode, `state.running` is true, and
`state.remainingSeconds ≈ deadline − now`.
Evidence: tests/e2e_timer.js check "VAL-BSYNC-002"

### VAL-BSYNC-003: Pomodoro block wins over a break
Given both a running pomodoro `running_block` and a server break state exist.
When a client rehydrates.
Then the pomodoro is restored (`timerMode === "pomodoro"`, `activeBlock` set),
not the break.
Evidence: tests/e2e_timer.js check "VAL-BSYNC-003"

### VAL-BSYNC-004: Break state cleared on end / pomodoro / pause
Given a running break with server state.
When it ends, a pomodoro starts, or it is paused.
Then the server `break_state` is cleared (`GET /api/dashboard` → `break_state:
null`).
Evidence: pytest tests/test_break_sync.py::test_clear_break + e2e "VAL-BSYNC-004"

### VAL-BSYNC-005: Expired break reads as none
Given a stored break whose deadline is in the past.
When `GET /api/dashboard` runs.
Then `break_state` is `null`.
Evidence: pytest tests/test_break_sync.py::test_expired_break_is_none

### VAL-BSYNC-006: No regression
Given the backend + e2e suites.
When they run.
Then pytest passes and e2e reports `failedCount: 0`.
Evidence: pytest -q ; cmux browser eval tests/e2e_timer.js → {"failedCount":0}
