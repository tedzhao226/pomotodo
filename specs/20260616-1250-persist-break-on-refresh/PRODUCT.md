# Persist Running Break Across Refresh

## Intent

A running break (short or long) is lost when the page is refreshed: the timer
disappears and the UI falls back to the idle pomodoro. A running pomodoro
survives refresh because it has a server-side block record that
`maybeRehydrateTimer` restores; breaks have no such record and no client
persistence, so they vanish.

Fix: persist a running break client-side (localStorage), and restore it on load
when there is no server block to rehydrate. Breaks are ephemeral and uncredited
— they have no place in the server model — so localStorage (where settings
already live) is the right home, mirroring the deadline-based timer the app
already uses.

Scope: frontend only. No server, no schema, no API. A running pomodoro and its
existing rehydration are unchanged.

## Behavior

- A running break is resumed after refresh, counting down from the same absolute
  deadline (real time elapsed during the reload is subtracted), exactly as a
  running pomodoro resumes from its `started_at`.
- A break that finished while the page was away advances to pomodoro on load
  (same as a natural break completion).
- A running pomodoro still wins: if the server reports a running block, that is
  rehydrated and any stale saved break is ignored.
- A paused break is not persisted — matching the existing pomodoro pause, which
  is also not preserved across refresh.

## Acceptance

### VAL-BRK-001: Running break persists to localStorage
Given a short or long break is running.
When the timer renders.
Then `localStorage["pomotodo.break"]` holds `{mode, deadline}` for that break.
Evidence: tests/e2e_timer.js check "VAL-BRK-001"

### VAL-BRK-002: Running break is restored on reload
Given a running break was persisted and the page reloads with no server running
block.
When `maybeRehydrateTimer` runs.
Then `state.timerMode` is the saved break mode, `state.running` is true, and
`state.remainingSeconds` ≈ `deadline − now`.
Evidence: tests/e2e_timer.js check "VAL-BRK-002"

### VAL-BRK-003: Break key is cleared when the break ends or a pomodoro runs
Given a persisted break.
When the timer switches to pomodoro (skip, completion, or starting a block).
Then `localStorage["pomotodo.break"]` is removed.
Evidence: tests/e2e_timer.js check "VAL-BRK-003"

### VAL-BRK-004: Running pomodoro still wins over a stale saved break
Given a server running block exists and a break key is also present.
When `maybeRehydrateTimer` runs.
Then the pomodoro block is rehydrated (`state.timerMode === "pomodoro"`,
`state.activeBlock` set), not the break.
Evidence: tests/e2e_timer.js check "VAL-BRK-004"

### VAL-BRK-005: No regression in existing timer behavior
Given the full e2e timer run.
When it completes.
Then it reports `failedCount: 0`.
Evidence: cmux browser eval tests/e2e_timer.js → {"failedCount":0}
