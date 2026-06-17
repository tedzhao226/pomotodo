# Fix e2e_timer failures + sound-off in tests

## Intent

`tests/e2e_timer.js` reports a non-deterministic 5–15 failed checks on a clean
server.

**True root cause (a real product bug):** the taskless-pomodoro work made
`block.task_id` nullable everywhere except the stats schema —
`StatsBlock.task_id` was left as `int`. Once a taskless block exists,
`GET /api/stats` 500s on pydantic validation. `syncNow()` fetches dashboard and
stats together (`Promise.all`), so the 500 sends it into its `catch` and the
client buffer (`state.dashboard` / `state.history`) **freezes stale**. Every e2e
check that reads the buffer after an operation then fails — the entire cascade.
(See FINDINGS.md for the instrumentation trail; the earlier "test state-bleed"
theory was a symptom.)

On top of the product fix, two test-quality items: the VAL-FREE section needed
state hygiene so its assertions are order-independent, and the suite ran with
**sound enabled** (`setSettings` never overrode `soundEnabled: true`).

Scope: `backend/schemas.py` (1 line) + `tests/e2e_timer.js` hygiene/sound +
backend regression test. No other product-code change (the `syncNow` race guard
that was trialed got reverted — not the cause).

## Behavior

- `startTaskless()` always starts a real **pomodoro** block: it selects the
  pomodoro tab and clears timer state first, so it works even when a prior
  completion left the timer in break mode.
- VAL8 asserts `blocks_done` **deltas** (C +1, A +0, B +0) instead of absolute
  values, and pins `streakBlocks` before the completion so the break type is
  deterministic — robust to VAL-FREE now legitimately crediting A and B.
- The deterministic `setSettings` helper sets `soundEnabled: false` (and keeps
  `tickEnabled: false`); a check asserts sound is off during the run.

## Out of scope

- Any `frontend/app.js` / backend change (VAL9 is cascade, not a code bug).
- Reworking the taskless feature itself.
- The pre-existing pass/flake of unrelated sections beyond what the cascade fix
  stabilizes.

## Acceptance

### VAL-FIX-001: e2e_timer is green and deterministic
Given a clean test server (fresh DB, `alembic upgrade head`).
When `tests/e2e_timer.js` is evaluated via the cmux browser harness twice.
Then both runs report `failedCount: 0`.
Evidence: two cmux browser eval runs of tests/e2e_timer.js → `window.__e2e.failedCount === 0`

### VAL-FIX-002: Taskless credit (VAL-FREE-005/006) increments blocks_done
Given the VAL-FREE section runs after the prior taskless completion left the
timer in break mode.
When `startTaskless()` starts the next block.
Then it is a real pomodoro block, the credit modal fires, and VAL-FREE-005
(`bd(A) === aBeforeFree + 1`) and VAL-FREE-006 pass.
Evidence: e2e_timer checks VAL-FREE-005, VAL-FREE-006 ok

### VAL-FIX-003: VAL8 credit + break type are correct and order-independent
Given VAL-FREE has already credited A and B.
When VAL8 completes the multi-touch block crediting only C.
Then C gains exactly +1 block, A and B are unchanged by VAL8, and the timer
transitions to a short rest.
Evidence: e2e_timer checks "VAL8: C credited +1", "VAL8: A unchecked", "VAL8: B removed earlier", "VAL8: transitions to short rest" ok

### VAL-FIX-004: VAL9 abort checks pass (cascade removed)
Given the upstream sections now leave clean state.
When the block is aborted via Esc.
Then the list highlight and timer label clear.
Evidence: e2e_timer checks "VAL9: exit clears list highlight", "VAL9: exit clears timer label" ok

### VAL-FIX-005: Tests run with sound off
Given the deterministic `setSettings` helper.
When settings are applied.
Then `state.settings.soundEnabled === false`.
Evidence: e2e_timer check "VAL-SOUND-001: sound off in tests" ok

### VAL-FIX-006: No regression in unit suites
Given the backend and frontend unit suites.
When they run.
Then `uv run pytest -q` and `npm test` both pass.
Evidence: pytest -q && npm test
