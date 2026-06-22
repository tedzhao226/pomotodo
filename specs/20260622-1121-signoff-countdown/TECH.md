# Approach

Frontend-only. One pure helper (unit-tested), one new setting, one new Today line, and a
once-a-minute tick. No backend, schema, or API change.

## Changes

1. **`frontend/helpers.js`** — add pure `signOffRemaining(now, hhmm)`:
   - Parse `hhmm` (`"HH:MM"`); blank/invalid → `return null`.
   - Build today's target `Date` from `now`'s local date + parsed H/M.
   - `now >= target` → `{past:true, hours:0, minutes:0}`.
   - Else `diffMin = floor((target - now)/60000)`; return
     `{past:false, hours: floor(diffMin/60), minutes: diffMin%60}`.
   - Add to the `module.exports` list (dual browser/vitest export, like `formatTime`).

2. **`frontend/app.js`**
   - `DEFAULT_SETTINGS`: add `signOffTime: "18:00"`.
   - `els`: bind `setSignoff` (settings input) and `signoffLine` (Today element).
   - Settings submit handler: read `signOffTime: els.setSignoff.value` (no clamping — a
     time input already constrains format; blank allowed).
   - `applySettingsToControls` (or settings view init): set `els.setSignoff.value` from
     `state.settings.signOffTime`.
   - New `renderSignoff()`: read `state.settings.signOffTime`, call
     `signOffRemaining(new Date(), …)`; `null` → hide `els.signoffLine`; `past` →
     `t("today.signoffPast", {time})`; else `t("today.signoff", {h, m, time})`. Call it
     from `renderTodayLog` (already runs on every dashboard render) **and** from a
     `setInterval(renderSignoff, 60000)` started at init so the line ticks without a sync.

3. **`frontend/index.html`** — in `#today-panel`, under the `<h2>`, add
   `<p id="signoff-countdown" class="signoff-countdown" hidden></p>`.

4. **`frontend/style.css`** — minimal `.signoff-countdown` rule (muted, small), matching
   existing Today typography.

5. **`frontend/i18n.js`** — add to **both** `en` and `zh`:
   - `settings.signOff`, `settings.signOffHint` (place in the General group, near
     `settings.dailyGoal`).
   - `today.signoff` ("{h}h {m}m until sign-off · {time}"), `today.signoffPast`
     ("Past sign-off · {time}"). Add the new settings field markup to `index.html`'s
     settings form with the matching `data-i18n` keys.

## Tests

- **Unit (`tests/js/helpers.test.js`)** — `signOffRemaining`: before target (h/m floor),
  exactly at target (`past`), after target (`past`), crossing-hour case, blank → `null`,
  malformed → `null`. Pass explicit `now` so it is deterministic. (VAL-SIGNOFF-002)
- **e2e (`tests/e2e/signoff.spec.js`)** — set sign-off via Settings, save, reload, assert
  the value persisted (VAL-SIGNOFF-001); assert the Today countdown line is visible with
  remaining text for a time later today, and hidden when the field is blanked
  (VAL-SIGNOFF-003). Use `_helpers.js` (`gotoApp`, settings nav).

## Verification commands

```sh
npm test                              # unit: signOffRemaining
npx playwright test signoff           # new e2e
npx playwright test timer             # regression on adjacent render/state specs
uv run pytest -q                      # backend untouched, sanity
```
