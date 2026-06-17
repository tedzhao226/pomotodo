# HANDOFF — syncNow resilience

## Outcome: DONE — all acceptance met

`syncNow` no longer couples two independent fetches or swallows errors. A broken
secondary endpoint can no longer blank the core UI or hide a 5xx.

## Change (one function, `frontend/app.js`)

`Promise.all` + silent `catch {}` → `Promise.allSettled` with independent slice
assignment, `console.warn` on each rejection, and `maybeRehydrateTimer()` gated on
a successful dashboard fetch.

Effect: a `/api/stats` failure keeps `state.dashboard` (tasks + running timer)
live; a `/api/dashboard` failure keeps `state.stats` live; both log instead of
freezing silently. This is the exact failure mode that hid the prior taskless
stats-500 bug.

## Schema audit (the other follow-up): CLEAN

`StatsBlock.task_id` (fixed in the prior spec) was the only nullable-miss. All
other block surfaces are already `int | None`; `blocks_override` isn't surfaced;
`AssignBlockRequest.task_id` is correctly required. No backend change.

## Acceptance

| id | status | evidence |
|----|--------|----------|
| VAL-SYNC-001 | ✅ | stats-fail: `state.dashboard` set, `.task-item` rows render, stats untouched |
| VAL-SYNC-002 | ✅ | `console.warn` fired for both failure paths |
| VAL-SYNC-003 | ✅ | dash-fail: stats updated, dashboard preserved; rehydrate gated |
| VAL-SYNC-004 | ✅ | e2e 90/0; pytest 48; vitest 12 |

## Follow-ups (optional, not done)

- User-facing sync-failure indicator / retry affordance (console signal is
  proportionate for now).
- Consider lazy-loading stats (only when the stats view / mini-cards are visible)
  to cut needless fetches — separate perf concern.
