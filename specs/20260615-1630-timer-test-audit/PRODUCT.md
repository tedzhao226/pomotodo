# Timer test audit & streamline

## Intent

The stateless-block timer (v0.1) is implemented and documented in
`docs/timer-states.md`. The test suite grew incrementally and has gaps
(pause/resume, auto-start, long-vs-short break) plus stale browser-harness
files. Audit the suite with Codex, streamline it, and ensure every design
behavior is covered by a runnable test. Browser flows are verified via
in-page eval (`tests/e2e_timer.js`), not browser-harness.

## Acceptance

Each behavior from `docs/timer-states.md` has a passing test.

- VAL-1 Idle: no auto-select; START disabled until a task is picked; clock
  shows full duration; "No task selected" label.
- VAL-2 Idle selection toggles: click selects, click again deselects.
- VAL-3 Start: `activeBlock` open, `activeTaskId` set, `running`,
  `touchedTaskIds = {task}`.
- VAL-4 Switch confirm: decline = no change; accept = active moves, task
  added to touched, timer keeps running (`deadline` unchanged).
- VAL-5 Chips: one per touched task; active chip has no ✕; non-active ✕
  removes that task from `touchedTaskIds`.
- VAL-6 Restart: same block id, countdown reset to full, touched kept.
- VAL-7 Pause/Resume: pause stops the countdown; resume continues.
- VAL-8 Completion credit: checklist of touched (all checked); confirm
  credits each checked task +1; unchecked credited 0; streak +1 once per
  block; block cleared; transitions to rest.
- VAL-9 Abort (Skip / Esc): no credit, block cleared.
- VAL-10 Auto-start: `autoStartRest` starts the break on completion;
  `autoStartPomodoros` starts the next block after a break.
- VAL-11 Long-vs-short break: `streakBlocks % longEvery === 0` → long.
- VAL-12 Backend credit: anchor reused, extra completed blocks created,
  unknown task id raises, duplicate ids deduped; only completed blocks
  count.
- VAL-13 First-load: a paused timer requires `remainingSeconds > 0`, so the
  idle clock initializes to full and the first START begins a block.

## Out of scope

No app behavior changes (tests only). No new e2e runner (keep in-page eval).
Rewriting the non-timer browser-harness tests (buckets/history/task_crud/
i18n_notes) beyond removing them if stale.
