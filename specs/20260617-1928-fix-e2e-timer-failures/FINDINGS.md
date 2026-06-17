# FINDINGS — Fix e2e_timer failures

## Research journal

### Symptom
`tests/e2e_timer.js` reports non-deterministic failures on a clean server:
one run 73/15, another 84/5. The 5 that fail in **every** run are the
deterministic core: VAL-FREE-005, VAL8 "C credited +1", VAL8 "transitions to
short rest", VAL9 "exit clears list highlight", VAL9 "exit clears timer label".
The other ~10 (BSYNC/REC/DEDUP/DEL) flake or cascade.

### Instrumented findings (browser harness, fresh DB)
- **VAL-FREE-005**: `aBefore:0 → aAfter:0`; at the credit point
  `modalHidden:true` and **no `/credit` POST was sent** (`posted:null`). The
  modal had already closed. So A is never credited — not a count race
  (an explicit extra `syncNow()` still showed `bd(A)=0`).
- **Why**: VAL-FREE-004 confirms a completion → `completeBlockWithCredit` →
  `switchMode("shortBreak", {auto:true})`. The timer is now in break mode.
  VAL-FREE-005's `startTaskless()` does **not** re-click the pomodoro tab, so
  `#timer-btn` starts a break countdown (no `activeBlock`); `expire()` then waits
  on a stale, hidden modal and the subsequent `confirmCredit()` clicks a dead
  modal.
- **VAL8**: `bdC:0, bdA:0, bdB:0` mid-run but `bdA:3` at end-of-run → credits do
  land later; VAL8 reads under cascade. `mode:longBreak` (expected short),
  `streakBefore:2` — the VAL-FREE completions bump `streakBlocks` before VAL8, so
  `streak % longEvery` lands on a long break.
- **VAL9**: state cleared (`activeBlock:null, activeTaskId:null`) but DOM stale
  (`activeCount:1`, label still the task) even after `sleep(200)`. **But VAL9
  passes in isolation** on a clean server (`domActiveCount:0`, label
  "No task selected"). → cascade, not a code bug.
- **Backend is correct**: `pytest tests/test_taskless_block.py
  ::test_unanchored_start_and_credit` (blocks_done=1) is green. The taskless
  credit path works; only the e2e harness state hygiene is broken.

### Coupling caveat
Once `startTaskless()` is fixed, VAL-FREE-005 credits A and VAL-FREE-006 credits
B. That breaks VAL8's absolute `bd(A)===0` / `bd(B)===0`. Audit of all `bd()`
assertions after VAL-FREE: only **VAL8** uses absolute counts; VAL9 (relative),
VAL-REC/DEDUP/DEL (note-based) are unaffected. Fix VAL8 to assert deltas and pin
the streak.

### Decision
Test-only fix (state hygiene + relative counts + sound off). No `frontend/app.js`
or backend change. Matches the evidence: backend green, VAL9 green in isolation.

### Harness notes
- `cmux browser wait --function` runs in an isolated world — cannot see app
  globals or `window.__e2e`. Poll via `eval` + sleep.
- Reuse-one-DB across runs pollutes state (e2e seeds A/B/C each run); use a fresh
  DB per run.
- Right after `goto`/reload the app globals aren't ready; settle ~3s before eval.

## TRUE root cause (supersedes the test-bleed theory)

The deterministic-then-cascade pattern was a symptom, not the cause. Tracing the
stale `state.dashboard` (server returned A=1, client buffer stuck at A=0 for 2s)
led to `syncNow`: it does `Promise.all([/api/dashboard, /api/stats])` and on any
rejection hits its `catch`, leaving the buffer **unchanged**.

`/api/stats` was returning **HTTP 500**:

```
pydantic ValidationError: StatsResponse blocks.0.task_id
  Input should be a valid integer [input_value=None]
```

The taskless-pomodoro work made `block.task_id` nullable in the model, dashboard,
and `BlockResponse`/`RunningBlock` schemas — but **missed `StatsBlock.task_id`**
(left as `int`). The moment a taskless block exists, `/api/stats` 500s, `syncNow`
silently fails, and the client buffer freezes. Every e2e check that reads
`state.dashboard`/`state.history` after an op then fails — which is the entire
5–15 cascade. The repository already returned `task_id: None` correctly; only the
schema was wrong.

This is a **real product bug** (incomplete nullable rollout), not a test issue:
any real user who starts a taskless pomodoro breaks their stats sync.

Fix: `backend/schemas.py` `StatsBlock.task_id: int | None` (one line). Plus the
test-hygiene + sound items already planned (still valid and still needed for a
clean, deterministic suite).

## Execution Log

- 2026-06-17 19:28 — plan written; spec folder created. Initial (wrong) root
  cause = VAL-FREE state bleed; fix presumed test-only.
- 2026-06-17 19:40 — **replanned**: instrumentation showed `/api/stats` 500s on
  taskless blocks → `syncNow` freezes `state.dashboard` → cascade. Real root
  cause is `StatsBlock.task_id` schema. Pivoted to a backend fix + the test
  hygiene/sound changes. A speculative `syncNow` out-of-order guard was tried and
  reverted (not the cause; kept the diff minimal).
- 2026-06-17 19:43 — fix verified: `StatsBlock.task_id: int | None`; e2e
  `failedCount: 0` on two clean runs (90/90); pytest 47 + regression (5 in
  test_taskless_block); vitest 12. All green.
