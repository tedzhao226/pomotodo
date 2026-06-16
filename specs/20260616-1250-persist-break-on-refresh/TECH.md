# Persist Running Break — Approach

## Root cause

`startCountdown` (app.js:385) runs both pomodoro and break timers off an absolute
`state.deadline`, but only the pomodoro is durable: `startBlock` POSTs a server
block, and `maybeRehydrateTimer` (app.js:696) restores that block on load. A
break is started by `switchMode(rest, {auto})` → `startCountdown` with no server
write and no client persistence, so a refresh drops it.

## Fix

Persist a running break in localStorage and restore it when no server block
rehydrates. Two render-driven chokepoints already exist; reuse them.

### 1. Persist (single chokepoint: `renderTimer`)

Add `BREAK_KEY = "pomotodo.break"` next to `SETTINGS_KEY` (app.js:4).

Add `persistBreak()` and call it inside `renderTimer()` (alongside the existing
`updateTabTitle()` call):

```text
function persistBreak():
    if state.timerMode != "pomodoro" and state.running and state.deadline:
        localStorage[BREAK_KEY] = JSON({ mode: state.timerMode, deadline: state.deadline })
    else:
        remove localStorage[BREAK_KEY]
```

Because `renderTimer` runs on every timer state transition (start, pause, resume,
switchMode, completion), this both saves a running break and clears the key the
moment the break pauses, ends, is skipped, or a pomodoro starts — no other call
sites needed.

### 2. Restore (`maybeRehydrateTimer`)

Restructure so the break is tried only when the server block does not claim the
timer:

```text
function maybeRehydrateTimer():
    if state.rehydrated: return
    state.rehydrated = true
    rb = dashboard.running_block
    if rb and not state.activeBlock:
        ...existing pomodoro restore...        # unchanged
        return
    if not state.activeBlock:
        maybeRehydrateBreak()

function maybeRehydrateBreak():
    raw = localStorage[BREAK_KEY]
    if not raw: return
    saved = JSON.parse(raw)  guarded; on bad data remove key + return
    if saved.mode not in {shortBreak, longBreak} or not saved.deadline:
        remove key; return
    state.timerMode = saved.mode
    state.deadline = saved.deadline
    remaining = round((saved.deadline - Date.now()) / (1000/TIME_SCALE))   # same formula as runTicker
    if remaining <= 0:
        remove key
        advanceAfterComplete()                 # break already done -> rest chime + back to pomodoro
        return
    startCountdown(remaining, advanceAfterComplete)
```

`advanceAfterComplete` for a rest mode (app.js:1356) plays the rest chime and
`switchMode("pomodoro", {auto:true})` — identical to a natural break finish, and
mirrors the pomodoro rehydrate path which also calls `advanceAfterComplete()`
when `remaining <= 0` (app.js:722).

## Why client-side, not server

Breaks carry no credit, no streak record, no task — nothing the backend tracks.
Adding a server break block would mean schema + API + migration for an ephemeral
countdown. localStorage already holds the other ephemeral client state
(settings), and the timer is already deadline-absolute, so persistence is a
two-field write.

## Out of scope

- Paused break persistence (pomodoro pause is not persisted either; matching it).
- Any server/schema/API change.
- Tab-title feature (separate, already shipped).

## Tests

In-browser e2e (`tests/e2e_timer.js`) — the only layer that sees live state +
localStorage. Add a self-contained `VAL-BRK` block that:

- starts a real break (auto-start rest) and asserts the key is written
  (VAL-BRK-001);
- simulates reload by clearing the live timer + `state.rehydrated = false` with
  `dashboard.running_block` null, calls `maybeRehydrateTimer`, asserts the break
  resumed (VAL-BRK-002);
- switches to pomodoro and asserts the key is removed (VAL-BRK-003);
- with a saved break key plus a server running block, asserts pomodoro wins
  (VAL-BRK-004).

A genuine page reload is not used because the harness is a single in-page script;
driving `maybeRehydrateTimer` directly exercises the exact load-time code path.

## Verification commands

```bash
npm test            # vitest regression (unaffected)
# e2e against a clean sqlite server (see prior run): uvicorn on a spare port,
#   POMOTODO_DATABASE_URL=sqlite:///tmp file + Base.metadata.create_all
SCRIPT=$(cat tests/e2e_timer.js); cmux browser <surface> eval "$SCRIPT"
#   then read window.__e2e -> {"failedCount":0}
```
