# TECH — Fix e2e_timer failures

## Approach

All edits live in `tests/e2e_timer.js`. Three changes:

### 1. `startTaskless()` — start from a clean pomodoro tab (RC: state bleed)

The helper currently clicks `#timer-btn` assuming the timer is idle in pomodoro
mode. After a prior completion the timer is in `shortBreak`, so the click starts
a break countdown (no `activeBlock`) and the later credit modal is stale.

```js
const startTaskless = async () => {
  el('.timer-tab[data-mode="pomodoro"]').click();  // ensure pomodoro mode
  await sleep(150);
  state.selectedTaskId = null;
  updateTimerControls();
  el("#timer-btn").click();
  await waitFor(() => !!state.activeBlock && state.running);
};
```

Idempotent for the first use (the section already clicks the tab at line 164).

### 2. VAL8 — relative counts + pinned streak (RC: order coupling)

Once VAL-FREE legitimately credits A and B, VAL8's absolute `bd(A)===0`,
`bd(B)===0` no longer hold. Capture baselines and pin the streak just before the
completion:

```js
// ---- VAL-8 ----
state.streakBlocks = 0;                 // deterministic break type (1 % longEvery !== 0)
const streakBefore = state.streakBlocks;
const c8 = bd(C), a8 = bd(A), b8 = bd(B);
await expire();
... existing modal checks ...
await confirmCredit([aId]);             // drop A, credit C
check("VAL8: C credited +1", bd(C) === c8 + 1);
check("VAL8: A unchecked -> +0", bd(A) === a8);
check("VAL8: B removed earlier -> +0", bd(B) === b8);
check("VAL8: streak +1 once", state.streakBlocks === streakBefore + 1);
check("VAL8: block cleared", state.activeBlock === null);
check("VAL8: transitions to short rest", state.timerMode === "shortBreak");
```

`longEvery` is 3 (from `setSettings`); streak 0→1 gives `1 % 3 !== 0` → short.

### 3. `setSettings()` — sound off + assert (user request)

```js
const setSettings = (over) => {
  state.settings = {
    ...state.settings,
    defaultDuration: 30, shortRest: 5, longRest: 20, longEvery: 3,
    autoStartPomodoros: false, autoStartRest: false,
    soundEnabled: false, tickEnabled: false,
    ...over,
  };
  ...
};
```

Add one check after the first `setSettings()` call in setup:

```js
check("VAL-SOUND-001: sound off in tests", state.settings.soundEnabled === false);
```

## Tests

Verification commands (clean server each run):

```sh
rm -f /tmp/pomo_test.db
POMOTODO_DATABASE_URL="sqlite:////tmp/pomo_test.db" uv run alembic upgrade head
POMOTODO_DATABASE_URL="sqlite:////tmp/pomo_test.db" uv run uvicorn backend.main:app --port 8731 &
# cmux browser goto http://localhost:8731 ; eval tests/e2e_timer.js ; read window.__e2e
uv run pytest -q
npm test
```

Run the full e2e **twice** on a fresh DB to prove determinism (VAL-FIX-001).

## Risks

- Other sections might carry hidden absolute-count coupling. Audit confirmed only
  VAL8 uses absolute `bd()`; VAL9/REC/DEL use relative or note-based checks.
- Harness gotchas (from prior session): `cmux browser wait --function` runs in an
  isolated world (can't see `state`/`window.__e2e`) — poll via `eval`. Use a
  fresh DB per run (shared DB pollutes via accumulated tasks).
