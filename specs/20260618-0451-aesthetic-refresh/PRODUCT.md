# Aesthetic refresh — legible warm minimalism

## Intent

The app's identity (coral accent, rounded Quicksand, soft cards on a warm
off-white) is pleasant, but a screenshot + token audit (see FINDINGS.md) shows it
reads **faint and low-hierarchy**: body text is mid-grey (`--ink #6b6b6b`),
secondary text fails WCAG (`--muted #b0aeaa` ≈ 2:1), the root was shrunk to 14px,
there is no type scale, Stats/Settings strand whitespace, and Settings leaks raw
i18n keys (`settings.notify`).

Refresh the visual layer **without redesigning**: keep the identity, fix
contrast/legibility, introduce a deliberate type scale, polish layout, and fix
the visible i18n defect. Changes stay in `frontend/style.css`, `frontend/i18n.js`,
and minor `frontend/index.html` — no backend, no behaviour change.

## Behavior

### Color & contrast
- Darken text tokens: `--ink` → a warm near-black (~`#33302b`), `--ink-strong` →
  the existing heading near-black (`#1f2a22`), so headline↔body has real weight.
- Raise `--muted` to a value that meets WCAG AA at body size (~`#7c776f`, ≥4.5:1
  on `#fff`).
- Keep the coral primary; harmonize the accent set (tags, charts) so each accent
  is ≥3:1 against the surface and tag-chip text is legible.

### Typography
- Define a documented type scale and weight system as tokens (e.g. `--fs-xs`…
  `--fs-2xl`, `--fw-normal/medium/semibold`); replace ad-hoc rem sizes with it.
- Set a comfortable base (15px root or 14px with the contrast fix — chosen in
  TECH), lift the smallest metadata off 0.8rem, and tune line-height/letter-
  spacing for the rounded face.

### Layout & polish
- Cap content width and tighten the grid on **Stats** and **Settings** so they
  don't strand whitespace; size the time-series + pie charts proportionally with
  legible labels and a cohesive palette.
- Add a little vertical rhythm to dense **Today/History** rows so metadata
  breathes; keep card padding/radius/shadow consistent.

### Defect
- Add EN + ZH strings for `settings.notify` / `settings.notifyHint` so Settings
  shows real labels.

## Out of scope

- Restructuring information architecture, nav, or features.
- New fonts/icon sets or a brand-color change (keep coral identity).
- Backend, data, or behaviour changes.
- Dark mode (note as a future follow-up only).

## Acceptance

### VAL-AES-001: Text meets WCAG AA contrast
Given the refreshed tokens.
When body and secondary text render on their backgrounds.
Then normal text is ≥4.5:1 and large/bold text ≥3:1 (measured for `--ink`,
`--ink-strong`, `--muted`, and tag-chip text).
Evidence: contrast ratios computed for each text/background pair in TECH.md.

### VAL-AES-002: A documented type scale is applied
Given the CSS.
When sizes/weights are set.
Then they come from named scale tokens (no scattered ad-hoc rem literals for the
refreshed surfaces), with a clear heading↔body hierarchy.
Evidence: `:root` exposes the scale; refreshed rules reference it.

### VAL-AES-003: Settings shows translated labels
Given the Settings view in EN and ZH.
When it renders.
Then no raw `settings.notify*` key is visible; both languages show real copy.
Evidence: screenshot of Settings (EN + ZH); `i18n.js` has the keys.

### VAL-AES-004: Views improve without layout regression
Given all four views.
When re-screenshotted after the refresh.
Then hierarchy/contrast are visibly improved and Stats/Settings no longer strand
large empty areas; nothing overflows, clips, or misaligns vs. the before-shots.
Evidence: after-screenshots in `runs/` compared to the before set.

### VAL-AES-005: No functional regression
Given the suites.
When they run.
Then `uv run pytest -q`, `npm test`, and the full browser e2e suite
(timer/task_crud/buckets/i18n_notes/history_delete = 144/144) all pass.
Evidence: suite output.
