# Sign-off countdown in Today

## Intent

Give a felt sense of how much working time is left in the day. The user sets a
**desired sign-off time** (when they want to stop for the day); the Today panel shows a
live "time left until sign-off" readout so hours-remaining is always visible while
working.

Scope is deliberately small: wall-clock time from now until the target, not a
break-adjusted "work hours" estimate (rejected as fuzzier). The target is a persisted
setting; the readout lives in the Today panel under its heading.

A blank sign-off time disables the readout (hides it) — the one branch a `<input
type="time">` naturally affords.

## Acceptance

### VAL-SIGNOFF-001: Sign-off time is a persisted setting
Given the Settings view.
When the user sets "Sign-off time" to a value and saves, then reloads the app.
Then the value is restored from `localStorage` (`pomotodo.settings.signOffTime`) and the
default before any change is `18:00`.
Evidence: npx playwright test signoff

### VAL-SIGNOFF-002: Remaining time is computed correctly (pure)
Given a current time `now` and a sign-off `HH:MM`.
When `signOffRemaining(now, hhmm)` is called.
Then before the target it returns `{past:false, hours, minutes}` floored to the minute;
at/after the target it returns `{past:true, hours:0, minutes:0}`; for a blank/invalid
`hhmm` it returns `null`.
Evidence: npm test (tests/js/helpers.test.js)

### VAL-SIGNOFF-003: Today panel shows the live countdown
Given a non-blank sign-off time before "now".
When the Today panel renders.
Then a countdown line is visible reading the remaining "Xh Ym" until sign-off (and a
"past sign-off" state once the target passes); a blank sign-off time hides the line.
Evidence: npx playwright test signoff
