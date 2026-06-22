# Findings

## Settings system (frontend/app.js)

- `DEFAULT_SETTINGS` (line 5) + `loadSettings`/`saveSettings` (19–30) merge over
  `localStorage["pomotodo.settings"]`. Adding a key here is the whole persistence story.
- Settings form submit handler (1923) rebuilds `state.settings` field-by-field from the
  bound `els.*` inputs, then `saveSettings` + `applySettingsToControls`. New field plugs
  in here.

## Today panel (frontend/app.js)

- `renderTodayLog` (1031) runs inside `renderDashboard` (696) on every mutation, and is
  also called directly (1288). It owns the `#today-panel` content. A `renderSignoff()`
  called from here covers all render paths; a 60s `setInterval` covers the idle tick
  (the panel otherwise only re-renders on sync/mutation).

## Pure-helper layer (frontend/helpers.js)

- `helpers.js` is dual-mode: browser global + `module.exports` (73) consumed by vitest
  (`tests/js/*`). `signOffRemaining` belongs here so VAL-SIGNOFF-002 is a deterministic
  unit test (`now` injected), not a clock-dependent e2e.

## i18n (frontend/i18n.js)

- Two locales only: `en` (line 4) and `zh` (155); flat dotted keys
  (`"today.title"`, `"settings.dailyGoal"`). New keys go in both.

## Decisions

- Wall-clock to target, **not** break-adjusted work-hours (user choice — simpler, less
  fuzzy).
- Display in the **Today** panel (user choice), not the header.
- Blank time hides the line (natural `<input type="time">` empty state) — no separate
  on/off toggle.

## Execution Log

- 2026-06-22 11:21 — plan written (PRODUCT/TECH/FINDINGS/TASKS). 3 serial tasks.
- 2026-06-22 11:39 — T1 in_progress: subagent wrote 6 signOffRemaining unit tests; red
  (`signOffRemaining is not a function`), correctly wired.
- 2026-06-22 11:43 — T2 in_progress → done; T1 → done. Subagent implemented helper +
  setting + Today line + i18n. Orchestrator ran `npm test` = 18/18 green (closes T1+T2).
  e2e `signoff` deferred to T3 (spec not yet written). Note: style.css `bucket-head`/caret
  edits are pre-existing uncommitted work, not from this task.
- 2026-06-22 11:47 — T3 in_progress → done. Fresh subagent wrote tests/e2e/signoff.spec.js
  (persist-across-reload VAL-001; Today line render+hide VAL-003). Orchestrator ran full
  acceptance: `npx playwright test signoff timer` PASS 3/0 · `npm test` 18/18 · `uv run
  pytest -q` 53. All tasks done → ready for /conductor verify.
