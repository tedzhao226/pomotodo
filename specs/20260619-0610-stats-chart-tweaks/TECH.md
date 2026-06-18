# Approach

All changes in `frontend/` — `app.js` (render) + `style.css` (one new rule). No
backend, no data shape change. No tests touch these charts (`grep svgLine/svgBars/
trend/mini-week tests/` → none), so verification is screenshot-only.

## VAL-1 — per-day counts on THIS WEEK card

`renderMiniCards` (app.js ~1070) builds `#mini-week` from `svgBars(...)` + `miniWeekAxis(week)`.
Add a counts row above the bars, mirroring `miniWeekAxis`'s flex-cell layout so the
numbers line up with the bars and the weekday initials. New helper `miniWeekValues(series)`
returns `<div class="mini-week-values">` of per-day counts, today's cell flagged
`is-today` (reuse the existing accent styling pattern). New CSS rule `.mini-week-values`.

## VAL-2 — trend chart as bars

`renderStats` (app.js ~1135) sets `#trend-chart` to `svgLine(trendSeries.map(d=>d.count))`
+ `trendAxis`. Swap `svgLine` for the existing `svgBars` helper at trend size
(`{ w: 640, h: 180 }`). `.bar` already fills `var(--pink)`; `trendAxis` stays.

## Tests

None added (visual-only). Verification: `npm run e2e`-style server + screenshot of
dashboard + stats view.
