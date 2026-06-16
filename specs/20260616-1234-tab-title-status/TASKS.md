# Tasks: Tab Title Live Status

**Goal**: Mirror the running block (timer · type · task) into `document.title`, idle → `Pomotodo`.
**Spec Folder**: /Users/ted/workspace/pomotodo/specs/20260616-1234-tab-title-status
**Acceptance**: /Users/ted/workspace/pomotodo/specs/20260616-1234-tab-title-status/PRODUCT.md (## Acceptance, VAL-TAB-*)

## Tasks

Execution: serial

```text
tasks[2]{id,title,depends_on,status,size,type,file,contract_refs,acceptance,write_set,backend,run_path,result}:
  T1,Add updateTabTitle helper + i18n + call sites,,done,M,impl,frontend/app.js,"VAL-TAB-001,VAL-TAB-002,VAL-TAB-003,VAL-TAB-004,VAL-TAB-005",npm test,"frontend/app.js,frontend/i18n.js",claude,runs/T1/,npm 12/12 green; helper + 2 call sites + tab.work/tab.rest EN+ZH added
  T2,Add e2e title checks and run full e2e,,done,S,test,tests/e2e_timer.js,"VAL-TAB-001,VAL-TAB-002,VAL-TAB-003,VAL-TAB-004,VAL-TAB-005,VAL-TAB-006",cmux browser eval tests/e2e_timer.js,tests/e2e_timer.js,claude,runs/T2/,e2e {"passed":62,"failedCount":0} (56 baseline + 6 new TAB checks) on clean sqlite server :8765
```

`status` values: `pending | in_progress | done | failed | blocked`.

### T1: Add updateTabTitle helper + i18n + call sites

Add a `tab.*` i18n namespace and an additive `updateTabTitle()` that projects
timer state into `document.title`. No timer behavior change.

1. `frontend/i18n.js`: add to EN table (near `timer.timeToFocus`, ~line 23) and
   ZH table (~line 162):
   - `tab.work`: EN `"Work"`, ZH `"工作"`
   - `tab.rest`: EN `"Rest"`, ZH `"休息"`
2. `frontend/app.js`: define `updateTabTitle()` (place it near `renderTimer`):
   - if `!timerIsActive()` → `document.title = "Pomotodo"`; return.
   - `time = formatTime(Math.max(state.remainingSeconds, 0))`.
   - `prefix = timerIsPaused() ? "⏸ " : ""`.
   - if `state.timerMode === "pomodoro"`: look up the active task name via
     `(state.dashboard ? state.dashboard.tasks : []).find(x => x.id === state.activeTaskId)`;
     `label = t("tab.work") + (name ? ": " + name : "")`.
   - else: `label = t("tab.rest")`.
   - `document.title = prefix + time + " · " + label`.
3. Call `updateTabTitle();` immediately after the two existing
   `els.timerDisplay.textContent = ...` writes:
   - in `renderTimer()` (app.js:305)
   - in `runTicker()`'s per-second block (app.js:347)

Do not touch index.html `<title>`, PALETTE, or any other behavior.

Acceptance: `npm test` still green (regression guard — no unit count change
expected); behavioral assertion is T2.
Contract refs: VAL-TAB-001, VAL-TAB-002, VAL-TAB-003, VAL-TAB-004, VAL-TAB-005

### T2: Add e2e title checks and run full e2e

In `tests/e2e_timer.js`, add checks asserting `document.title` against live state
(reuse existing helpers `byName`, `idOf`, `start`, `abortEsc`, `t`,
`state`, `formatTime`):

- `VAL-TAB-001`: with a work block running on a known task, assert
  `document.title === formatTime(Math.max(state.remainingSeconds,0)) + " · " + t("tab.work") + ": " + <name>`.
- `VAL-TAB-002`: in a running break, assert title === `formatTime(...) + " · " + t("tab.rest")` (no `: ` task segment).
- `VAL-TAB-003`: pause a running block, assert `document.title.startsWith("⏸ ")`.
- `VAL-TAB-004`: after abort → idle, assert `document.title === "Pomotodo"`.
- `VAL-TAB-005`: snapshot title, force one tick (advance `state.deadline`),
  assert the `MM:SS` segment changed and equals `formatTime(state.remainingSeconds)`.

Then run the whole e2e against a clean test-server surface and confirm
`{"failedCount":0}` (VAL-TAB-006).

Acceptance: `SCRIPT=$(cat tests/e2e_timer.js); cmux browser eval --surface <id> "$SCRIPT"` → `{"failedCount":0}`.
Contract refs: VAL-TAB-001..005, VAL-TAB-006
