# Tasks: Persist Running Break Across Refresh

**Goal**: Persist a running break in localStorage and restore it on load when no server block rehydrates.
**Spec Folder**: /Users/ted/workspace/pomotodo/specs/20260616-1250-persist-break-on-refresh
**Acceptance**: /Users/ted/workspace/pomotodo/specs/20260616-1250-persist-break-on-refresh/PRODUCT.md (## Acceptance, VAL-BRK-*)

## Tasks

Execution: serial

```text
tasks[2]{id,title,depends_on,status,size,type,file,contract_refs,acceptance,write_set,backend,run_path,result}:
  T1,Persist + rehydrate running break,,done,M,impl,frontend/app.js,"VAL-BRK-001,VAL-BRK-002,VAL-BRK-003,VAL-BRK-004",npm test,frontend/app.js,claude,runs/T1/,npm 12/12; persistBreak (guarded on rehydrated) + maybeRehydrateBreak; real-reload smoke restored break (remaining elapsed-subtracted)
  T2,Add e2e break-persist checks and run full e2e,,done,S,test,tests/e2e_timer.js,"VAL-BRK-001,VAL-BRK-002,VAL-BRK-003,VAL-BRK-004,VAL-BRK-005",cmux browser eval tests/e2e_timer.js,tests/e2e_timer.js,claude,runs/T2/,e2e 67/67 failedCount 0 on fresh sqlite db; VAL-BRK-002 strengthened to cover pre-rehydrate render
```

`status` values: `pending | in_progress | done | failed | blocked`.

### T1: Persist + rehydrate running break

In `frontend/app.js`:

1. Add `const BREAK_KEY = "pomotodo.break";` next to `SETTINGS_KEY` (line 4).
2. Add `persistBreak()`: if `state.timerMode !== "pomodoro" && state.running &&
   state.deadline`, write `localStorage[BREAK_KEY] = JSON.stringify({ mode:
   state.timerMode, deadline: state.deadline })`; else `removeItem(BREAK_KEY)`.
   Call `persistBreak();` inside `renderTimer()` next to the existing
   `updateTabTitle();` call.
3. Add `maybeRehydrateBreak()`: read+parse `BREAK_KEY` (guard JSON; on bad data
   or bad `mode`/missing `deadline`, remove key + return); set
   `state.timerMode`/`state.deadline`; `remaining = Math.round((deadline -
   Date.now())/(1000/TIME_SCALE))`; if `remaining <= 0` remove key +
   `advanceAfterComplete()`; else `startCountdown(remaining,
   advanceAfterComplete)`.
4. In `maybeRehydrateTimer()`, restore the pomodoro block when `rb &&
   !state.activeBlock` (existing logic, unchanged, then `return`); otherwise, if
   `!state.activeBlock`, call `maybeRehydrateBreak()`.

Do not touch the server, schema, or the pomodoro restore body. No paused-break
persistence.

Acceptance: `npm test` still green (regression guard); behavior verified in T2.
Contract refs: VAL-BRK-001, VAL-BRK-002, VAL-BRK-003, VAL-BRK-004

### T2: Add e2e break-persist checks and run full e2e

In `tests/e2e_timer.js`, add a self-contained `VAL-BRK` block (reuse helpers
`setSettings`, `start`, `expire`, `confirmCredit`, `state`, `el`):

- VAL-BRK-001: drive to a running break (e.g. `setSettings({autoStartRest:true})`
  then complete a pomodoro, or set `timerMode`+`startCountdown` directly), assert
  `JSON.parse(localStorage.getItem("pomotodo.break")).mode` is the break mode and
  `.deadline` is a number.
- VAL-BRK-002: simulate reload — `clearTimerInterval(); state.activeBlock = null;
  state.running = false; state.rehydrated = false;` and ensure
  `state.dashboard.running_block` is null — then call `maybeRehydrateTimer()` and
  assert `state.timerMode` is the saved break mode, `state.running === true`, and
  `state.remainingSeconds > 0`.
- VAL-BRK-003: `await switchMode("pomodoro", { auto: false })` (or start a block),
  assert `localStorage.getItem("pomotodo.break") === null`.
- VAL-BRK-004: write a break key manually, set a fake `state.dashboard.running_block`
  (or reuse a real one), `state.rehydrated = false; state.activeBlock = null;`
  call `maybeRehydrateTimer()`, assert `state.timerMode === "pomodoro"` and
  `state.activeBlock` set (pomodoro wins).

Restore quiet settings + clear the break key at the end. Then run the whole e2e
against a clean sqlite server and confirm `{"failedCount":0}` (VAL-BRK-005).

Acceptance: `SCRIPT=$(cat tests/e2e_timer.js); cmux browser <surface> eval "$SCRIPT"` → `{"failedCount":0}`.
Contract refs: VAL-BRK-001..004, VAL-BRK-005
