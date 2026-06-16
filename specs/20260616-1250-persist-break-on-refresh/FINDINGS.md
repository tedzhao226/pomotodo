# Findings: Persist Running Break Across Refresh

## Relevant Files

- `frontend/app.js` — timer + rehydration.
  - `startCountdown` (385) runs both pomodoro and break off absolute `deadline`.
  - `maybeRehydrateTimer` (696) restores ONLY the server `running_block`
    (pomodoro). No break path → the bug.
  - `switchMode(rest, {auto})` (1327) auto-starts a rest via `startCountdown` —
    no server write, no persistence.
  - `advanceAfterComplete` (1350) rest branch: chime + `switchMode("pomodoro")`.
  - `renderTimer` (now ~280) is the universal render chokepoint (already hosts
    `updateTabTitle()`); the place to hook `persistBreak()`.
  - Constants: `TIME_SCALE=1` (1), `SETTINGS_KEY` (4).
- `tests/e2e_timer.js` — in-browser e2e; only layer that sees live state +
  localStorage.

## Discoveries

- Pomodoro pause is itself not persisted across refresh: rehydrate recomputes
  remaining from `started_at`, so it resumes as running with elapsed time
  counted. Therefore persisting only the *running* break (not paused) matches
  existing behavior — no need to persist paused breaks.
- The timer is deadline-absolute, so persisting `{mode, deadline}` and recomputing
  `remaining = (deadline - now)/(1000/TIME_SCALE)` reuses the exact `runTicker`
  formula; real time during reload is correctly subtracted.
- Hooking `persistBreak()` into `renderTimer` gives save + clear for free: every
  transition that leaves break-running state (pause, skip, completion, pomodoro
  start) re-renders and clears the key.

## Knowledge Updates

- Breaks are client-only ephemeral countdowns (no credit/streak/task/server
  record); their durable home is localStorage, like settings.

## Drift

- None. Fix matches the user's report (running break lost on refresh) and the
  existing pomodoro-rehydrate design.

## Durable Candidates

- None.

## Execution Log

Append-only. One entry per status transition.

### [2026-06-16 12:52] T1 — in_progress → done

- status: done
- backend: claude
- contract_refs: VAL-BRK-001..004
- tests_run: `npm test` → 12/12 (regression guard).
- evidence: added `BREAK_KEY`, `persistBreak()` (called in `renderTimer`),
  `maybeRehydrateBreak()`, and a pomodoro-first restructure of
  `maybeRehydrateTimer`. **Caught a real-reload bug the simulated e2e missed:**
  init renders the idle pomodoro before the async rehydrate, and `persistBreak`
  wiped the saved key first. Fixed with a `if (!state.rehydrated) return;` guard
  in `persistBreak`. Verified by genuine cmux page reload: break restored as
  `shortBreak`, running, remaining elapsed-subtracted, title `02:52 · Rest`.
- run_path: runs/T1/

### [2026-06-16 12:57] T2 — in_progress → done

- status: done
- backend: claude
- contract_refs: VAL-BRK-001..004, VAL-BRK-005
- tests_run: full e2e via cmux browser eval on a clean sqlite server →
  `{"passed":67,"failedCount":0}`. (A re-run on a dirty DB showed 2 unrelated
  VAL8 credit failures from leftover server blocks; a fresh DB run was clean.)
- evidence: added the `VAL-BRK` block; strengthened VAL-BRK-002 to render the
  idle pomodoro pre-rehydrate and assert the key survives — this is the check
  that now guards the regression found in T1. Plus a manual real-reload smoke.
- run_path: runs/T2/

## Drift (update)

- The simulated-reload e2e initially gave a false PASS: it called
  `maybeRehydrateTimer` without the pre-rehydrate idle render that a real load
  performs. A genuine cmux reload exposed the wipe. Lesson recorded; VAL-BRK-002
  now reproduces it. Real page-reload smoke is part of acceptance for
  load-time behavior, not just in-page simulation.
