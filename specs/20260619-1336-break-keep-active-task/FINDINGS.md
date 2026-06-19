# Findings

## State model (frontend/app.js)

- `selectedTaskId` — task picked in idle/rest; drives the row highlight (`focusId`,
  ~597) and the timer "Task:" label (`updateTimerControls`, ~457), and is the default
  for `startPomodoro` (~1783). **Was nulled at every block end** (1465, 1522).
- `pendingTaskId` / `pendingTaskless` / `pendingDuration` — carry-over for the next
  pomodoro, consumed only by the auto-start path (`switchMode` auto, ~1638). Default
  `autoStartPomodoros: false`, so the carry was invisible on the manual path.
- `activeTaskId` / `activeBlock` — the running block; untouched by this change.
- Tasks carry `status ∈ {"active","done"}`; mark-done toggles it (~2082) and the task
  stays in `state.dashboard.tasks` (only `clearCompleted` removes it).

## Why the gap

Manual return-to-pomodoro reads `selectedTaskId` (nulled), so the previous task was
lost; auto path read `pendingTaskId` (kept). The two carriers diverged at block end.

## Detach point

`renderDashboard` (697) calls `updateTimerControls`; the mark-done handler calls
`renderAll` (2097) → `renderDashboard`. So extending the existing stale-selection prune
in `updateTimerControls` to also drop `done` tasks is the one place that covers every
way a task becomes done. No mark-done-handler change needed.

## Decision

Detach trigger = **task marked done** (user choice). Not "pomo completed" — a skipped or
completed pomo on a still-open task resumes after the break.

## Execution Log

- 2026-06-19 13:36 — plan written (PRODUCT/TECH/FINDINGS/TASKS). Inline exec (≤3 tasks).
- 2026-06-19 13:40 — T1/T2 done: spec + app.js carry/detach. T3 verify surfaced two
  stale timer-suite checks: VAL9 ("exit clears highlight/label") contradicts the new
  carry; VAL8 ("checklist lists touched 2 / all checked") was already red from the
  uncommitted **credit also-today** feature in the working tree (creditableIds/extras/
  `credit.alsoToday`) — the "previous state change" to consolidate. Updated both checks
  to the consolidated behavior.
- 2026-06-19 13:54 — all green: pytest 52, vitest 12, e2e 17 (incl. new break-resume +
  updated timer suite). VAL-BREAK-003 `pending` assertion made `expect.poll` to absorb a
  debounced-sync vs mark-done-PATCH race in the shared-DB full run.
