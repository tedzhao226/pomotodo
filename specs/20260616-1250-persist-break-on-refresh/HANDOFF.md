# Handoff — Persist Running Break Across Refresh — 2026-06-16 12:58

## Goal

Stop a running break from vanishing on page refresh: persist it client-side and
restore it on load when no server pomodoro block rehydrates.

## Shipped

- `/Users/ted/workspace/pomotodo/frontend/app.js`:
  - `BREAK_KEY = "pomotodo.break"`.
  - `persistBreak()` — saves `{mode, deadline}` for a running break, clears it
    otherwise. Called in `renderTimer`. Guarded with `if (!state.rehydrated)
    return;` so the pre-rehydrate idle render does not wipe a saved break.
  - `maybeRehydrateBreak()` — restores a saved break, recomputing remaining from
    the absolute deadline; advances to pomodoro if it already expired.
  - `maybeRehydrateTimer()` restructured: server pomodoro block wins; otherwise
    rehydrate the break.
- `/Users/ted/workspace/pomotodo/tests/e2e_timer.js`: `VAL-BRK` checks, including
  the pre-rehydrate-render regression guard.

## Acceptance

```text
tasks[2]{id,title,contract_refs,result}:
  T1,Persist + rehydrate running break,"VAL-BRK-001..004",done
  T2,Add e2e break-persist checks and run full e2e,"VAL-BRK-001..005",done
```

- VAL-BRK-001: pass — running break persisted to localStorage.
- VAL-BRK-002: pass — break restored on reload; key survives the pre-rehydrate render.
- VAL-BRK-003: pass — key cleared when a pomodoro runs.
- VAL-BRK-004: pass — server pomodoro block wins over a stale break key.
- VAL-BRK-005: pass — full e2e `{"passed":67,"failedCount":0}`.

## Verification

- [x] `npm test` → 12/12.
- [x] e2e on clean sqlite server :8765 → `{"passed":67,"failedCount":0}`.
- [x] Genuine cmux page reload during a break → restored `shortBreak`, running,
      remaining elapsed-subtracted (180→172s), title `02:52 · Rest`.

## Follow-ups

- Uncommitted on `master`. This change plus the earlier tab-title change both sit
  in the working tree (frontend/app.js, frontend/i18n.js, tests/e2e_timer.js).
  Branch + commit when ready (global rule: branch before committing on default).
- Paused break is intentionally not persisted (matches pomodoro pause, also not
  preserved across refresh). Revisit only if users expect a paused break to hold.

## Context

- Branch: master
- Spec: /Users/ted/workspace/pomotodo/specs/20260616-1250-persist-break-on-refresh
- Working directory: /Users/ted/workspace/pomotodo
