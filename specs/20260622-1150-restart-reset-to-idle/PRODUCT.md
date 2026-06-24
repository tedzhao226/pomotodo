# Restart resets the timer to idle ("no state")

## Intent

Change the restart button (↺) from "re-run the same block immediately" to "reset to
**no state**": stop the current timer and return the panel to idle/ready for the **current
mode** — work *or* rest. Nothing auto-starts. Only clicking **Start (▶)** begins a new
timer (a fresh work block, or a fresh rest countdown).

Today restart is pomodoro-only, requires an open block, and instantly re-runs that block
from full. The new behavior:

- Works for **work and rest**.
- A running/paused **work** block is **discarded** (abort — no credit, streak resets), the
  same as the existing Esc/Skip abort. A running **rest** is cleared (server break removed).
- **Confirm only past 1/3** elapsed (reuse the existing discard confirm). Under 1/3, and
  any rest, reset silently — mirrors the Skip-to-break threshold.
- Restart is enabled whenever a timer is active (running or paused); disabled when idle.

Esc-to-stop is unchanged (out of scope). Doc (`docs/timer-states.md`) is updated to match.

## Acceptance

### VAL-RESTART-001: Restart a running rest → idle, same mode, break cleared
Given a running short or long break.
When restart is clicked.
Then `state.running === false`, `state.timerMode` is unchanged, `state.remainingSeconds`
is the full duration for that mode, and the server break is cleared (`DELETE /api/break`,
so a reload shows idle). No confirm dialog.
Evidence: npx playwright test restart

### VAL-RESTART-002: Restart a barely-started work pomo → silent discard to idle
Given a running work block with under 1/3 elapsed and tasks in `touchedTaskIds`.
When restart is clicked.
Then no confirm appears; the block is discarded server-side (`PATCH completed:false`),
`state.activeBlock === null`, `state.timerMode === "pomodoro"`, `state.running === false`,
`remainingSeconds` is full, `touchedTaskIds` is empty, and `streakBlocks === 0`.
Evidence: npx playwright test restart

### VAL-RESTART-003: Restart a worked-in pomo (≥1/3) confirms; cancel is a no-op
Given a running work block with at least 1/3 elapsed.
When restart is clicked and the confirm is **cancelled**.
Then nothing changes — the same `activeBlock` is still open, still running, touched set
intact. When restart is clicked and **confirmed**, it discards to idle exactly as
VAL-RESTART-002.
Evidence: npx playwright test restart

### VAL-RESTART-004: Start after restart begins a NEW timer
Given the panel is idle after a restart.
When Start (▶) is clicked.
Then a new timer begins — in work mode a new server block opens (a different `activeBlock.id`
than the discarded one); in rest mode the countdown runs.
Evidence: npx playwright test restart

### VAL-RESTART-005: Restart button enablement tracks an active timer
Given the timer panel.
When idle (no running/paused timer) the restart button is disabled; when a timer is
running or paused (work or rest) it is enabled.
Evidence: npx playwright test restart

### VAL-RESTART-006: Docs reflect the new restart semantics
Given `docs/timer-states.md`.
When restart is described (state machine, notes, counting invariants, changelog).
Then it states restart resets to idle / discards the block (abort), not "re-runs the same
block"; no stale "same block / touched kept" restart claims remain.
Evidence: grep -n restart docs/timer-states.md (manual read)
