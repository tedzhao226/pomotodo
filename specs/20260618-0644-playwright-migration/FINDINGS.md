# FINDINGS — Playwright migration

## Starting state

5 cmux scripts, ~1240 lines, ~144 checks. Coupling measured:

| script | checks | `state.` | api | deadline-poke |
|---|---|---|---|---|
| e2e_timer | 90 | 146 | 6 | 5 |
| e2e_history_delete | 16 | 8 | 3 | 0 |
| e2e_task_crud | 14 | 3 | 0 | 0 |
| e2e_buckets | 15 | 1 | 0 | 0 |
| e2e_i18n_notes | 10 | 0 | 0 | 0 |

→ four light/DOM-driven suites (idiomatic Playwright) + one extreme-internal timer
(in-page via `page.evaluate`). App.js is a classic script with globals, no exports,
so Playwright reaches internals through `page.evaluate` (same main-world access the
cmux `eval` used).

## Decisions

- Self-managed server/DB in `playwright.config.js` webServer (wipe+migrate in the
  command, before uvicorn serves — globalSetup runs too late).
- `workers: 1` (server singletons).
- Timer: run the original logic in-page via a generated `timerSuite()`, assert the
  report. Parity over purity for that suite.

## Execution Log

- 2026-06-18 06:44 — plan. Installed @playwright/test + chromium (confirmed
  installable). Spec authored.
- 2026-06-18 ~07:00 — P0 infra: config + webServer + helpers. First run failed
  ("no such table": webServer starts before globalSetup) → folded wipe+migrate into
  the webServer command. i18n-notes proved the harness after fixing: settings-view
  for `#set-lang`, `dispatchEvent` for badge-overlapped row actions, `data-id`
  locators. **i18n-notes 2/2.**
- 2026-06-18 ~07:10 — task-crud (exact-match for substring rename) **2/2**;
  history-delete (`.nav-btn` scope, `openHistory()` await) **1/1**; buckets
  (synthetic drag, `expect.poll` re-sync) **3/3**.
- 2026-06-18 ~07:20 — timer suite generated from the original; **1/1 (90 checks,
  17s)**. Full `npm run e2e`: **9 passed (24s)**, self-contained.
- 2026-06-18 ~07:25 — removed old `tests/e2e_*.js`; CLAUDE.md rewritten for
  Playwright; vitest still 12/12. All tasks done.
