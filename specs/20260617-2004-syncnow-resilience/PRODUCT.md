# syncNow resilience refactor

## Intent

Follow-up to the e2e_timer fix (`specs/20260617-1928-fix-e2e-timer-failures`).
The taskless stats-schema 500 stayed invisible for a long time because
`syncNow()` couples two independent fetches and swallows all errors:

```js
const [dashboard, stats] = await Promise.all([api("/api/dashboard"), api("/api/stats")]);
state.dashboard = dashboard; state.stats = stats; ...
catch { /* silent */ }
```

Two structural problems:

1. **Coupling** — `Promise.all` fails atomically. A `/api/stats` failure discards
   a perfectly good `/api/dashboard`, so the **core UI (tasks + running timer)
   goes blank** even though only the secondary stats charts are broken. The app
   boots with `syncNow()` as its last line, so a returning user who has a taskless
   block would see a frozen, empty app.
2. **Silent catch** — a persistent 5xx produces no signal at all; the buffer just
   freezes. That is exactly why the bug hid for so long.

Refactor `syncNow` so the two fetches are independent and failures are visible.
The schema audit (other nullable-miss fields) is part of this work and came back
clean — `StatsBlock.task_id` was the only one; no further schema change.

## Behavior

- `syncNow` applies dashboard and stats **independently**: whichever fetch
  succeeds updates its slice of the buffer; a failure of one never discards the
  other.
- A failed fetch is **logged** (`console.warn`), not silently swallowed.
- Timer rehydration runs only after a **successful** dashboard fetch (so a failed
  first dashboard load doesn't permanently skip rehydrate).
- Render is buffer-driven and null-safe (existing `renderAll` already guards on
  `state.dashboard` / `state.stats`), so a partial buffer renders what it has.

## Out of scope

- A user-facing error banner / retry UI (console signal is proportionate for a
  latent backend-contract failure; can be added later if desired).
- Changing **how often** stats is fetched, or lazy-loading it.
- Backend changes (audit clean; no new nullable-miss).

## Acceptance

### VAL-SYNC-001: A failing /api/stats does not blank the dashboard
Given `/api/stats` rejects but `/api/dashboard` succeeds.
When `syncNow()` runs.
Then `state.dashboard` is populated and the task list renders (core UI intact);
`state.stats` is left unchanged.
Evidence: browser harness — stub `api` to reject for `/api/stats`, run `syncNow()`,
assert `state.dashboard` set + `.task-item` rows present.

### VAL-SYNC-002: Sync failures are surfaced
Given a fetch in `syncNow` rejects.
When it is handled.
Then a `console.warn` is emitted (no silent swallow).
Evidence: code review of `syncNow`; browser harness spy on `console.warn`.

### VAL-SYNC-003: Dashboard-only failure still updates stats, and vice versa
Given one of the two endpoints fails.
When `syncNow()` runs.
Then the succeeding endpoint's slice updates and rehydrate runs iff dashboard
succeeded.
Evidence: browser harness — stub each side independently.

### VAL-SYNC-004: No regression
Given the full suites.
When they run.
Then e2e_timer reports `failedCount: 0`, `pytest -q` passes, `npm test` passes.
Evidence: e2e 90/0; pytest; vitest.
