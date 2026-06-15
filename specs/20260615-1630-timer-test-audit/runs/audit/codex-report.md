Static read-only audit only; no files edited and tests not run.

**A) Coverage Matrix**
| # | Status | Evidence / Gap |
|---|---|---|
| 1 Idle | COVERED | `tests/e2e_timer.js:44-50` checks no selected task, START disabled, no-task label, `30:00`. |
| 2 Selection toggle | COVERED | `tests/e2e_timer.js:52-61` selects then deselects same task. |
| 3 Start block | COVERED | `tests/e2e_timer.js:63-70` checks `activeBlock`, `activeTaskId`, `running`, touched set. |
| 4 Switch confirm | COVERED | `tests/e2e_timer.js:72-87` covers declined and accepted switch, touched growth, unchanged deadline. |
| 5 This-block chips | COVERED | `tests/e2e_timer.js:89-101` checks chip count, active chip has no remove, non-active remove drops task. |
| 6 Restart | PARTIAL | `tests/e2e_timer.js:103-109` checks same block id and reset-ish countdown, but touched preservation assertion is weak: it does not assert both expected IDs remain. |
| 7 Pause/Resume | MISSING | App has `pauseTimer`/`resumeTimer` in `frontend/app.js:373-390`, but no test exercises them. |
| 8 Completion | PARTIAL | `tests/e2e_timer.js:111-126` and `tests/test_bucket.py:91-110` cover modal/credit basics, unchecked task, removed task, block cleared. Missing: all boxes checked by default, streak increments once per block, transition to rest, short-vs-long branch. |
| 9 Abort | PARTIAL | `tests/e2e_timer.js:127-137` covers Esc no-credit/block-clear. Missing Skip-button path and paused-abort path; test also does not assert rest transition from the spec. |
| 10 Auto-start settings | MISSING | `tests/e2e_timer.js:30-31` only disables both settings. No positive `autoStartRest` or `autoStartPomodoros` coverage. |
| 11 Backend invariants | PARTIAL | Completed-only is covered by `tests/test_bucket.py:71-83`, `120-141`; credit happy/unchecked/unknown-task by `91-117`. Missing duplicate-id dedupe, unknown block id, API route-level `/blocks/{id}/credit`, and first-load paused-timer fix from `frontend/app.js:268-274`. |

**B) Redundancy / Streamlining**
- `tests/e2e_timer.js` is the right home for timer-state browser coverage; keep it as the timer acceptance script.
- `tests/js/helpers.test.js` and `tests/js/i18n.test.js` are useful unit tests, but they do not materially cover the stateless-block timer spec.
- `tests/test_bucket.py` has some overlap around “aborted blocks do not count” across task counts, stats, and tag summaries. Keep at least one direct counting test plus one stats/tag surface if those outputs are important; do not treat all three as timer acceptance coverage.
- `tests/bh_*.py` are stale as timer verification. They use browser-harness, sleeps, and older flow assumptions. `bh_history.py` is especially stale because timer completion now opens the credit modal.
- `bh_i18n_notes.py` partly duplicates `tests/js/helpers.test.js`/`i18n.test.js`; keep only if live DOM language/note rendering smoke is still wanted.

**C) Correctness Bugs In Tests**
- `tests/e2e_timer.js:30-50` assumes default duration is 30 minutes but only sets auto-start flags. Persisted `localStorage` settings can make the `30:00` assertion fail or mask timer-duration bugs.
- `tests/e2e_timer.js:109` says touched preserved `(A,C)` but only asserts size `2` and presence of `C`; it should also assert `A` is still present and `B` is absent.
- `tests/e2e_timer.js:111-126` does not assert that checklist inputs start checked, even though that is a spec requirement.
- `tests/bh_history.py:79-80` sets `state.remainingSeconds = 1`, but the current timer is deadline-based; the ticker recomputes remaining time from `state.deadline`. It also never confirms the credit modal, so the intended completed-pomo history assertion is stale.
- All `bh_*.py` rely on fixed sleeps instead of waiting for concrete DOM/state conditions, making them flaky against async sync/render timing.

**D) Prioritized Test Changes**
1. `tests/e2e_timer.js`: reset deterministic timer settings at setup: default duration, rest durations, `longEvery`, selected state, remaining seconds, and auto-start flags.
2. `tests/e2e_timer.js`: add pause/resume case after block start: pause freezes remaining seconds, resume keeps same block and countdown continues.
3. `tests/e2e_timer.js`: strengthen restart assertion to check exact touched set `{A,C}` and unchanged block id.
4. `tests/e2e_timer.js`: extend completion case to assert all checklist boxes default checked, `streakBlocks` increments by `1`, block clears, and timer transitions to short rest when not at long interval.
5. `tests/e2e_timer.js`: add long-break case with `longEvery` set low enough to prove `streakBlocks % longEvery === 0`.
6. `tests/e2e_timer.js`: add positive auto-start cases for `autoStartRest` and `autoStartPomodoros`.
7. `tests/e2e_timer.js`: add Skip-button abort and paused-abort coverage, not just Esc.
8. `tests/test_bucket.py`: add duplicate credit ids dedupe case and unknown block id raises case.
9. `tests/test_bucket.py`: strengthen credit anchor behavior by asserting the original block is completed for the anchor and only extra task ids get extra completed rows.
10. Remove or archive `tests/bh_history.py`; either remove remaining `bh_*.py` from active verification or rewrite desired live-browser smoke checks as in-page eval scripts.


Codex session ID: 019ec9fa-b7e8-79b1-85dd-f5fff64f3084
Resume in Codex: codex resume 019ec9fa-b7e8-79b1-85dd-f5fff64f3084
