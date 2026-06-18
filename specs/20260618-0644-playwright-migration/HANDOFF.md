# HANDOFF — Playwright migration

## Outcome: DONE

All 5 cmux browser-harness scripts are now Playwright specs. `npm run e2e` boots
its own server on a fresh DB and runs everything headless — **9 passed (24s)**,
no manual server, no cmux. Old scripts removed; CLAUDE.md updated; vitest 12/12.

## What shipped

- `playwright.config.js` — self-managed uvicorn webServer (wipe+migrate then
  serve), `workers: 1`, traces.
- `tests/e2e/` — `i18n-notes`, `task-crud`, `history-delete`, `buckets`,
  `timer` specs + `_helpers.js` + `_timer-suite.js`.
- `package.json` — `npm run e2e`. `@playwright/test` devDep.
- Removed `tests/e2e_*.js` (5 files). CLAUDE.md "Full testing" rewritten.

## Acceptance

| id | status | evidence |
|----|--------|----------|
| VAL-PW-001 green & self-contained | ✅ | `npm run e2e` → 9 passed, own server/DB |
| VAL-PW-002 coverage parity | ✅ | 4 suites mapped 1:1 idiomatically; timer runs all 90 original checks in-page |
| VAL-PW-003 one spec per suite | ✅ | 5 specs, each passes individually |
| VAL-PW-004 old harness retired | ✅ | old scripts gone; e2e script added; CLAUDE.md updated; vitest 12/12 |
| VAL-PW-005 modern time control | ✅ | timer advances via `state.deadline` poke, not real countdown waits |

## Notes / trade-offs

- **Timer parity-over-purity**: the 90-check timer suite runs its original
  in-page logic via `page.evaluate` rather than an idiomatic rewrite — it tests
  the state machine + pure globals the app exposes only in-page. Documented in
  TECH. Future: incrementally peel user-visible parts into locator-based tests
  and adopt `page.clock` for time.
- `workers: 1` (server singletons `running_block`/`break_state`). Per-worker DBs
  would unlock parallelism later.
- chromium only; add firefox/webkit projects if cross-browser is wanted.
- First-time/CI setup: `npx playwright install chromium`.
