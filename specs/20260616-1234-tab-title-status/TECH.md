# Tab Title Live Status — Approach

## Design

One additive helper, `updateTabTitle()`, mirroring the existing
`updateTimerControls` / `renderTimer` render pattern. It reads existing state and
writes `document.title`. No new state, no new state transitions.

```text
function updateTabTitle():
    if not timerIsActive():            # idle (no run, not paused)
        document.title = "Pomotodo"
        return
    time = formatTime(max(state.remainingSeconds, 0))
    prefix = "⏸ " if timerIsPaused() else ""
    if state.timerMode == "pomodoro":
        name = name of task with id state.activeTaskId   # from state.dashboard.tasks
        label = t("tab.work") + (": " + name if name else "")
    else:                              # shortBreak | longBreak
        label = t("tab.rest")
    document.title = prefix + time + " · " + label
```

Key facts grounding the helper (all already in app.js):

- `timerIsActive()` = `state.running || timerIsPaused()` (app.js:276).
- `timerIsPaused()` = not running, `0 < remainingSeconds < duration` (app.js:267).
- `state.timerMode` ∈ `pomodoro | shortBreak | longBreak` (app.js:39).
- Active task id = `state.activeTaskId`; name via
  `state.dashboard.tasks.find(t => t.id === state.activeTaskId)` — same lookup
  `updateTimerControls` uses for the on-screen current-task label (app.js:419-422).
- `formatTime(seconds)` → `MM:SS`, in helpers.js:1 (already unit-tested).

## Call sites (mirror the timer-display writes)

Two existing lines write `els.timerDisplay.textContent`; call `updateTabTitle()`
immediately after each so the title and the on-screen timer always agree:

1. `renderTimer()` — app.js:305 (covers every state change: start, pause, mode
   switch, completion → idle, abort → idle).
2. `runTicker()` per-second tick — app.js:347 (covers the live countdown,
   VAL-TAB-005).

Because `renderTimer()` runs on completion/abort and at load, the idle reset
(VAL-TAB-004) needs no separate hook.

## i18n

Add two keys to both locales in i18n.js, next to the other `timer.*` strings:

- `tab.work`: EN `"Work"`, ZH `"工作"`
- `tab.rest`: EN `"Rest"`, ZH `"休息"`

(New `tab.*` namespace to avoid colliding with the existing `timer.timeToFocus`
sentence strings.)

## Out of scope

- index.html `<title>` stays `Pomotodo` (the runtime sets it; static default is
  the idle value, so no change needed).
- No favicon / no flashing / no notification API.
- No truncation of long task names (the browser truncates the tab itself).
- PALETTE / styling untouched.

## Tests

In-browser e2e (`tests/e2e_timer.js`) is the only layer that can observe
`document.title` against live state — app.js is a classic script with no module
exports, so `updateTabTitle` is not unit-importable. Add checks there:

- VAL-TAB-001: start a work block on a known task; assert
  `document.title === formatTime(state.remainingSeconds) + " · Work: <name>"`.
- VAL-TAB-002: in a running break, assert title ends `· Rest` and has no `:`
  task segment.
- VAL-TAB-003: pause a running block; assert title starts with `⏸ `.
- VAL-TAB-004: after abort/idle, assert `document.title === "Pomotodo"`.
- VAL-TAB-005: capture title, let one tick pass, assert the `MM:SS` segment
  changed and matches `formatTime(state.remainingSeconds)`.
- VAL-TAB-006: whole run reports `failedCount: 0`.

## Verification commands

```bash
# Unit (regression guard, no new unit tests expected to change count)
npm test            # vitest run — helpers/i18n

# Backend regression (unaffected, sanity)
pytest -q

# e2e (authoritative for this feature) — against a clean test server surface
SCRIPT=$(cat tests/e2e_timer.js); cmux browser eval --surface <id> "$SCRIPT"
# then: cmux browser wait --function "window.__e2e!==null" ; read window.__e2e
# expect {"failedCount":0}
```
