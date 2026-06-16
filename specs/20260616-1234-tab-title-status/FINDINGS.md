# Findings: Tab Title Live Status

## Relevant Files

- `frontend/app.js` — timer state + render. `renderTimer()` (305) and
  `runTicker()` tick (347) are the two `els.timerDisplay.textContent` writes to
  mirror. State shape at 32-63; `timerIsActive`/`timerIsPaused` 267-278; active
  task lookup `updateTimerControls` 409-422.
- `frontend/i18n.js` — `t()` lookup tables; add `tab.work`/`tab.rest` to EN (~23)
  and ZH (~162).
- `frontend/helpers.js` — `formatTime(seconds) → MM:SS` (1), already exported &
  unit-tested.
- `frontend/index.html` — static `<title>Pomotodo</title>` (6); the idle value,
  left unchanged.
- `tests/e2e_timer.js` — in-browser e2e (~56 checks); only layer that can assert
  on live `document.title`. Globals `state`, `t`, `updateTimerControls`,
  `timerIsPaused` reachable in eval scope.

## Discoveries

- app.js is a **classic script**, not a module — no exports, so `updateTabTitle`
  cannot be unit-tested in vitest. e2e is the authoritative test layer here.
- Work vs rest is fully determined by `state.timerMode`: `pomodoro` = work,
  `shortBreak`/`longBreak` = rest. Break modes do not set `state.activeBlock`,
  but the countdown still runs (`timerIsActive()` true), so the title must key on
  `timerMode`, not `activeBlock`.
- The on-screen current-task label already does the exact task-name lookup the
  title needs (`tasks.find(t => t.id === state.activeTaskId)`), so the title is a
  pure projection of state — no new data required.
- `renderTimer()` is invoked on completion and abort (→ idle), so the idle reset
  falls out of the same call site with no extra hook.

## Knowledge Updates

- Feature is a read-only state projection into `document.title`; zero timer
  behavior change. Risk is limited to (a) wrong call-site coverage and (b) i18n
  key collision — both addressed in TECH.md.

## Drift

- None. User-confirmed format (timer-first; paused frozen + `⏸`; idle →
  `Pomotodo`) matches the acceptance table.

## Durable Candidates

- None beyond the existing memory; this is a small additive frontend feature.

## Execution Log

Append-only. One entry per status transition.

### [2026-06-16 12:39] T1 — in_progress → done

- status: done
- backend: claude
- contract_refs: VAL-TAB-001, VAL-TAB-002, VAL-TAB-003, VAL-TAB-004, VAL-TAB-005
- tests_run: `npm test` → 12/12 passed (regression guard, unchanged count)
- evidence: added `updateTabTitle()` near `renderTimer`; called after both
  `els.timerDisplay.textContent` writes (renderTimer + runTicker tick); added
  `tab.work`/`tab.rest` to EN+ZH i18n. Server already sends `Cache-Control:
  no-cache` (backend/main.py:22), so no `?v=` bump needed.
- run_path: runs/T1/

### [2026-06-16 12:44] T2 — in_progress → done

- status: done
- backend: claude
- contract_refs: VAL-TAB-001..005, VAL-TAB-006
- tests_run: full e2e via cmux browser eval against a clean sqlite-backed server
  (`POMOTODO_DATABASE_URL=sqlite:///…` + `Base.metadata.create_all`, uvicorn
  :8765) → `{"passed":62,"failedCount":0,"failed":[]}`. 56 baseline + 6 new TAB
  checks, no regression (VAL-TAB-006).
- evidence: added a self-contained `VAL-TAB` block in tests/e2e_timer.js that
  drives state directly and asserts `document.title` for work/rest/paused/idle
  and per-second tracking. Report at runs/T2/e2e-report.json.
- run_path: runs/T2/
