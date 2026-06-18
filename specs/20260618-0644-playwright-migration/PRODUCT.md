# Migrate browser e2e to Playwright

## Intent

The 5 browser e2e suites (`tests/e2e_*.js`, ~1240 lines, ~144 checks) are
self-contained scripts run by hand through the **cmux browser harness**
(`cmux browser eval`). That harness is bespoke, not CI-runnable, single-surface,
serial-by-hand, and (as this session showed) full of foot-guns: isolated-world
`wait`, manual fresh-DB juggling, surface reclamation, no traces.

Migrate them to **Playwright Test** — a standard, CI-runnable runner with its own
server/browser lifecycle, auto-waiting locators, web-first assertions, traces, and
fake-clock time control. Preserve coverage (every existing check becomes a
Playwright assertion/step); modernize the mechanics.

## Behavior

- `npx playwright test` (and `npm run e2e`) boots its own app server on a fresh
  throwaway DB, runs all converted specs headless, and reports pass/fail — no
  manual server, no cmux, no surface ids.
- The 5 suites map 1:1 to specs under `tests/e2e/`:
  `timer.spec.js`, `task-crud.spec.js`, `buckets.spec.js`, `i18n-notes.spec.js`,
  `history-delete.spec.js`. Each preserves its original checks.
- DOM/user-visible behaviour uses Playwright locators + web-first assertions.
  App internals the app forces tests to touch (it ships globals, not a test API —
  `state`, `syncNow`, `timerIsPaused`, `updateTabTitle`) are read via
  `page.evaluate`, wrapped in `expect.poll` for waiting.
- Timer expiry uses Playwright's **fake clock** (`page.clock`) instead of poking
  `state.deadline`; a documented `page.evaluate` deadline-poke is the fallback if
  the app's timer doesn't cooperate with the fake clock.
- Server singletons (`running_block`, `break_state`) forbid parallelism →
  `workers: 1`, `fullyParallel: false`.
- After parity is proven, the old `tests/e2e_*.js` are removed and the CLAUDE.md
  "Full testing" section is rewritten for Playwright. Vitest unit tests are
  untouched.

## Out of scope

- Changing what is tested (no new behaviours; coverage parity only).
- Touching backend logic or the vitest unit suite.
- Visual-regression / screenshot testing (separate concern).
- Cross-browser (chromium only for now).

## Acceptance

### VAL-PW-001: Playwright suite runs green, self-contained
Given a clean checkout with deps installed.
When `npm run e2e` runs.
Then Playwright boots its own server on a fresh DB and all converted specs pass,
with no manual server start and no cmux harness.
Evidence: `npm run e2e` exit 0; report shows all specs passed.

### VAL-PW-002: Coverage parity
Given the 5 original suites (~144 checks).
When mapped to specs.
Then every original check has a corresponding Playwright assertion/step (counted
per file); none silently dropped.
Evidence: per-file check→assertion mapping in FINDINGS; assertion counts ≥ originals.

### VAL-PW-003: One spec per original suite
Given `tests/e2e/`.
When listed.
Then `timer`, `task-crud`, `buckets`, `i18n-notes`, `history-delete` specs exist
and each passes individually (`playwright test <spec>`).
Evidence: each spec green.

### VAL-PW-004: Old harness retired, docs updated
Given the migration is complete.
When the repo is inspected.
Then `tests/e2e_*.js` are removed, `package.json` has an `e2e` script, and
CLAUDE.md's full-testing section documents Playwright (not cmux). Vitest still
green.
Evidence: `npm test` passes; CLAUDE.md updated; old scripts gone.

### VAL-PW-005: Modern time control
Given the timer spec.
When it forces completion/break transitions.
Then it uses `page.clock` (fake timers) or a documented `page.evaluate` fallback —
not real-time `sleep` waits for the countdown.
Evidence: timer.spec.js uses clock/evaluate; no multi-second real sleeps for expiry.
