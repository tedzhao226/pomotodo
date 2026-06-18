# TECH — Playwright migration

## Setup

- `@playwright/test@1.61` (devDep) + chromium (`npx playwright install chromium`).
- `playwright.config.js`: `testDir: tests/e2e`, `workers: 1`, `fullyParallel:
  false` (server singletons), `webServer` boots uvicorn after wiping+migrating a
  throwaway DB, `baseURL` port 8788, `trace: on-first-retry`.
- `package.json`: `"e2e": "playwright test"`. Vitest `"test"` untouched.
- gitignore: `test-results/`, `playwright-report/`, `.last-run.json`,
  `/blob-report/`, `playwright/.cache/`.

## Server + DB lifecycle (key fix)

Playwright starts the `webServer` **before** `globalSetup`, so a globalSetup
migration runs too late — the server's `/api/dashboard` health check hits an
unmigrated DB and times out. Fold wipe+migrate into the webServer command so it
finishes before uvicorn serves:

```
command: "rm -f /tmp/pomo_pw.db && uv run alembic upgrade head && uv run uvicorn backend.main:app --port 8788"
reuseExistingServer: false   // always fresh per run
```

Specs seed unique-suffixed data (the original pattern), so no per-test reset.

## Conversion rules

| original | Playwright |
|---|---|
| `check(name, cond)` | `expect(...)` / web-first assertion |
| `state.X` read | `page.evaluate(() => state.X)`, waited via `expect.poll` |
| `api(path, opts)` seeding | `evalApi(page, path, opts)` = `page.evaluate(api)` |
| `window.confirm = () => v` | `stubConfirm(page, v)` (in-page override) |
| `element.click()` on row action | `rowAction(scope, action)` = `dispatchEvent('click')` |
| drag (synthetic DragEvents) | same DragEvent sequence inside `page.evaluate` |
| `state.deadline = Date.now()-1000` | same poke via `page.evaluate` (instant) |

### Gotchas hit (encoded in helpers/specs)

- Row action buttons are hover-revealed + overlapped by `.block-badge`; a
  coordinate click (even `force:true`) lands on the badge. Use `dispatchEvent`.
- Locate rows by `data-id`: a `hasText` filter stops matching once the name
  becomes an `<input>` in the editor.
- `[data-view="history"]` is ambiguous (nav button + mini-cards) — scope to
  `.nav-btn[data-view=...]`.
- `#set-lang` lives in the hidden Settings view — open Settings first.
- `expect.poll` re-syncs for "persisted after sync" (replaces the `syncUntil`
  helper) and for any server-reflected state.
- History pomos load async on the History view — call `openHistory()` and wait
  for the seeded pomos, don't race the nav click.

## Timer suite

`_timer-suite.js` is the original `e2e_timer.js` body transformed into an exported
`timerSuite()` that returns `{passed, failedCount, failed}` instead of stashing
`window.__e2e`. `timer.spec.js` runs it via `page.evaluate(timerSuite)` and asserts
`report.failed` is empty. Rationale: 90 checks of state-machine + pure-global logic
(`timerIsPaused`, `updateTabTitle`, `formatTime`) that app.js exposes only in-page —
a full idiomatic rewrite is disproportionate and risky; this preserves 100% parity
under Playwright's runner/server/CI. Generated programmatically (zero transcription
risk).

## Tests / verification

```sh
npm run e2e        # 9 specs, self-contained, expect: 9 passed
npm test           # vitest unchanged
```
