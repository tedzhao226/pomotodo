# Cross-Device Break Sync — Approach

## Server: a singleton break state

A break has no task, so it cannot reuse `Block` (task-anchored FK). Add a tiny
one-row table holding the running break, mirroring the `{mode, deadline}` shape
the client already uses for localStorage (lazy port, not a new data model).

- `backend/models.py` — `BreakState(Base)`: `id` PK (always 1),
  `mode: str` (`shortBreak|longBreak`), `deadline_ms: BigInteger` (absolute
  epoch ms — same value the client computes today).
- `alembic/versions/0005_break_state.py` — create table; `down_revision =
  "0004_block_note"`.

### Repository / service

- `set_break(mode, deadline_ms)` — upsert the id=1 row.
- `clear_break()` — delete the row if present.
- `get_break()` — return `{mode, deadline}` or `None`, **lazy-expiring**: if
  `deadline_ms <= now_ms`, delete and return `None` (VAL-BSYNC-005).

### API + dashboard

- `PUT /api/break` body `{mode, deadline}` → `set_break`. 204.
- `DELETE /api/break` → `clear_break`. 204.
- `DashboardResponse` += `break_state: BreakStateOut | None = None`
  (`{mode, deadline}`); `get_dashboard` calls `get_break()`. Because the read
  rides the existing dashboard fetch, second-device pickup needs no new endpoint
  on the read path.

Keep `running_block` and `break_state` independent: a pomodoro never sets a
break, and rehydrate prefers `running_block` (VAL-BSYNC-003).

## Frontend: server replaces localStorage

Delete the localStorage break path from spec 20260616-1250 (`BREAK_KEY`,
`persistBreak`'s storage writes, `maybeRehydrateBreak`'s `localStorage` read, and
the `state.rehydrated` guard that existed only to protect the localStorage key).

### Write (transition-diffed, not per-tick)

Network writes must not fire every render/tick. Replace `persistBreak()` with
`syncBreak()` that diffs desired-vs-last and only calls the API on change:

```text
let lastBreakKey = null            // module-scoped
function syncBreak():
    const desired = (timerMode != "pomodoro" && running && deadline)
        ? `${timerMode}|${deadline}` : "none"
    if desired === lastBreakKey: return
    lastBreakKey = desired
    if desired === "none":
        api("/api/break", { method: "DELETE" }).catch(()=>{})   // next sync retries
    else:
        api("/api/break", { method: "PUT",
            body: JSON.stringify({ mode: timerMode, deadline }) }).catch(()=>{})
```

Call `syncBreak()` from `renderTimer()` (the existing chokepoint where
`persistBreak()` was) — every break transition (start, pause, resume, switch to
pomodoro, completion) re-renders, and the diff guard makes it hit the network
only when the running-break state actually changes. Fire-and-forget; a dropped
request is reconciled on the next transition.

### Rehydrate (read from dashboard, not localStorage)

`maybeRehydrateTimer` already prefers `running_block`. Replace the localStorage
break branch with the server value:

```text
if rb and not activeBlock: ...restore pomodoro...; return
if not activeBlock and dashboard.break_state:
    const { mode, deadline } = dashboard.break_state
    timerMode = mode; this.deadline = deadline
    remaining = round((deadline - Date.now())/(1000/TIME_SCALE))
    if remaining <= 0: advanceAfterComplete()      # finished while away
    else: startCountdown(remaining, advanceAfterComplete)
```

Runs on the first post-load sync (same as pomodoro), so a second device picks the
break up on open. `lastBreakKey` should be seeded to match the restored state so
the immediate re-render doesn't redundantly re-PUT.

## Tests

- `tests/test_break_sync.py` (sqlite `Service` fixture):
  `test_set_and_read_break`, `test_clear_break`, `test_expired_break_is_none`.
- `tests/e2e_timer.js`: rework the `VAL-BRK` block (localStorage) into
  `VAL-BSYNC` (server):
  - start a break, assert `GET /api/dashboard` `break_state.mode/deadline` set
    (001);
  - simulate a second device: clear live timer + `state.rehydrated=false`,
    ensure no `running_block`, `await syncNow()`, assert break resumed (002);
  - plant a `running_block` too, assert pomodoro wins (003);
  - switch to pomodoro, assert dashboard `break_state` null (004).

## Verification commands

```bash
pytest -q
npm test
# e2e on a clean sqlite server (prior-spec pattern): uvicorn + create_all
SCRIPT=$(cat tests/e2e_timer.js); cmux browser <surface> eval "$SCRIPT"  # {"failedCount":0}
```

## Notes / risks

- Supersedes the localStorage break-persist; that spec's VAL-BRK e2e checks are
  replaced by VAL-BSYNC (server). Update, don't leave both.
- Deadline is client-computed absolute epoch ms; cross-device skew = the two
  devices' clock difference (typically <1s), same class of skew pomodoro already
  tolerates (`rb.started_at` vs client `Date.now()`).
- Live mid-session push is out of scope (rehydrate runs once on load). A device
  already open won't adopt a break started elsewhere until it reloads.
