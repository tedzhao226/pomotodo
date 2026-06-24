# Tasks: Sign-off countdown in Today

**Goal**: Persisted sign-off time + live "time left" readout in the Today panel.
**Spec Folder**: /Users/ted/workspace/pomotodo/specs/20260622-1121-signoff-countdown
**Acceptance**: /Users/ted/workspace/pomotodo/specs/20260622-1121-signoff-countdown/PRODUCT.md (## Acceptance, VAL-SIGNOFF-*)

## Tasks

Execution: serial

```text
tasks[3]{id,title,depends_on,status,size,type,file,contract_refs,acceptance,write_set,tier,run_path,result}:
  T1,Unit test signOffRemaining,,done,S,test,tests/js/helpers.test.js,VAL-SIGNOFF-002,npm test,tests/js/helpers.test.js,standard,runs/T1/,6 cases (before/at/after target + sub-hour floor + blank/malformed→null); red until T2 then green
  T2,Impl helper + setting + Today line + i18n,T1,done,M,impl,frontend/app.js,"VAL-SIGNOFF-001,VAL-SIGNOFF-002,VAL-SIGNOFF-003","npm test && npx playwright test signoff","frontend/helpers.js,frontend/app.js,frontend/index.html,frontend/style.css,frontend/i18n.js",standard,runs/T2/,helper+export; signOffTime default 18:00 via applySettingsToControls+submit; renderSignoff in renderTodayLog + 60s tick; #signoff-countdown line; en/zh keys. npm test 18/18 green (e2e signoff deferred to T3)
  T3,e2e + full verify,T2,done,M,review,tests/e2e/signoff.spec.js,"VAL-SIGNOFF-001,VAL-SIGNOFF-003","npx playwright test signoff timer && npm test && uv run pytest -q",tests/e2e/signoff.spec.js,review,runs/T3/,signoff.spec.js 2 tests (persist+render/hide); full set green: e2e 3/3 (signoff+timer) · vitest 18 · pytest 53
```

### T1: Unit test signOffRemaining

Write `tests/js/helpers.test.js` cases for a `signOffRemaining(now, hhmm)` not yet in
`frontend/helpers.js` (import alongside existing helpers). Inject explicit `now` Dates so
results are deterministic. Cover: before target → floored `{past:false, hours, minutes}`;
exactly at target → `{past:true,0,0}`; after target → `past`; a sub-hour gap (hours 0);
blank `""` → `null`; malformed (`"9"`, `"99:99"`) → `null`. (VAL-SIGNOFF-002)

### T2: Impl helper + setting + Today line + i18n

Per TECH.md ## Changes: add pure `signOffRemaining` to `frontend/helpers.js` (+ export);
`signOffTime:"18:00"` in `DEFAULT_SETTINGS`; settings `<input type="time">` (markup +
`els` bind + submit read + value restore); `#signoff-countdown` line in `#today-panel`
with `renderSignoff()` called from `renderTodayLog` and a 60s `setInterval`; `.signoff-
countdown` style; `settings.signOff*` + `today.signoff`/`today.signoffPast` keys in both
`en` and `zh`. T1 must go green. (VAL-SIGNOFF-001/002/003)

### T3: e2e + full verify

Write `tests/e2e/signoff.spec.js` (uses `_helpers.js`): set + save + reload asserts
persistence (VAL-SIGNOFF-001); Today line visible with remaining text for a later time,
hidden when blanked (VAL-SIGNOFF-003). Run the full verification command set; all green =
done.
