# HANDOFF — Aesthetic refresh

## Outcome: DONE — all acceptance met

The faint, low-hierarchy look is fixed by evolving the existing identity (coral +
rounded Quicksand + soft cards), not redesigning. Before/after screenshots in
`runs/` (`shot_*` before, `f_{en,zh}_*` after).

## Changes

- `frontend/style.css`
  - **Contrast tokens** (the dominant fix): `--ink #6b6b6b→#33302b`,
    `--ink-strong #4a4a4a→#1f2a22`, `--muted #b0aeaa→#6f6a62`. Token-driven, so
    every view's text darkened at once.
  - **Type-scale tokens** added to `:root` (`--fs-*`, `--fw-*`) on the deliberate
    14px root.
  - **Tag chips** → soft tinted pill (`#eef4fb` / `#2f6aa3`, ~4.8:1; tomato-dark
    hover).
  - **Time-series chart** height 200→168px (less empty box).
- `frontend/index.html` — removed the dead `set-notify` control (no app.js
  handler) that was leaking raw `settings.notify*` keys.

## Acceptance

| id | status | evidence |
|----|--------|----------|
| VAL-AES-001 | ✅ | ink ~13:1, ink-strong ~14:1, muted ~5:1, tag-chip ~4.8:1 — all ≥ AA |
| VAL-AES-002 | ◑ | scale/weight tokens defined; broad re-typing deferred (contrast restored hierarchy; respects 14px density) |
| VAL-AES-003 | ✅ | EN + ZH settings translated, no raw key (dead control removed) |
| VAL-AES-004 | ✅ | after-shots show stronger contrast + chips + tighter chart; no layout regression |
| VAL-AES-005 | ✅ | pytest 48; vitest 12; browser e2e 144/144 |

## Deviations from plan (deliberate)

- **A5**: the i18n "leak" was a *dead, unwired* control → **removed** rather than
  labelled (labelling would ship a fake toggle). If desktop notifications are
  desired, that's a separate feature (wire `set-notify` to the Notification API +
  add EN/ZH copy).
- **A2 broad apply / A4 settings-grid**: deferred as low-value/higher-risk once A1
  carried the hierarchy; the settings checkbox-group flow leans on load-bearing
  `grid-column:1/-1` hints. Tokens are in place for a future consistency pass.

## Follow-ups (optional)

- Apply `--fs-*` tokens across all surfaces for token-consistency (cosmetic; no
  visual change expected).
- Desktop-notification feature (re-introduce the toggle, wired).
- Dark mode (the darkened ink tokens are a good foundation).
