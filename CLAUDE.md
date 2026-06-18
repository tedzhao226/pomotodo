# Pomotodo — Project Guidelines

## Testing

Three layers, all runnable locally:

- **Backend unit** — `uv run pytest -q` (`tests/test_*.py` over `backend/`).
- **Frontend unit** — `npm test` (vitest, `tests/js/*.test.js`; pure helpers/i18n only — `app.js` is a classic script with no exports).
- **Browser e2e (full testing)** — `npm run e2e` (Playwright, `tests/e2e/*.spec.js`).

### Full testing: Playwright

```sh
npm run e2e                      # all specs, headless
npx playwright test timer        # one spec
npx playwright test --headed     # watch it run
npx playwright show-trace ...    # inspect a failure trace
```

Self-contained: `playwright.config.js` `webServer` wipes + re-migrates a throwaway
sqlite DB (`/tmp/pomo_pw.db`), boots uvicorn on port 8788, and tears it down — no
manual server, no cmux. Server singletons (`running_block`, `break_state`) forbid
parallelism, so `workers: 1`, serial. First-time setup needs the browser:
`npx playwright install chromium`.

Specs under `tests/e2e/` (one per original suite): `timer`, `task-crud`,
`buckets`, `i18n-notes`, `history-delete`. Shared helpers in `_helpers.js`.

Conventions (the app ships globals, not a test API — `app.js` is a classic script
with no exports):

- DOM/user-visible behaviour → locators + web-first assertions
  (`expect(locator).toBeVisible()`, `toHaveClass`, `toHaveText`).
- App internals the app forces tests to touch (`state`, `syncNow`, `timerIsPaused`,
  `updateTabTitle`) → `page.evaluate`, wrapped in `expect.poll` for waiting.
- **Row action buttons** (edit/delete/move/pin/toggle) are hover-revealed and
  overlapped by the block badge — click them with `rowAction(scope, action)`
  (dispatchEvent), not coordinate clicks (even `force:true` lands on the badge).
- Locate task rows by **`data-id`** (a row's `hasText` stops matching once its name
  becomes an `<input>` in the editor).
- The **timer** suite (`timer.spec.js` + `_timer-suite.js`) is internal-coupled
  enough that it runs the full state-machine sequence in-page via `page.evaluate`
  and asserts the per-check report; time is advanced by poking `state.deadline`
  (instant), not real waits.
