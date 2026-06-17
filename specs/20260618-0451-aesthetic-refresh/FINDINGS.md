# FINDINGS — Aesthetic refresh

## Method

Seeded a realistic demo DB (7 tasks across Today/Backlog with tags + estimates,
6 completed pomodoros, 1 done todo) and screenshotted all four views via the cmux
browser harness. Before-screenshots: `runs/shot_{main,stats,history,settings}.png`
(gitignored). Measured live computed styles + read `frontend/style.css` `:root`.

## Measured design tokens (current)

| token | value | role |
|---|---|---|
| root font-size | **14px** | recently shrunk to 87.5% (commit f695c9d) |
| `--bg` | `#f3f2ef` | warm off-white page |
| `--surface` | `#ffffff` | cards |
| `--ink` | `#6b6b6b` | **body text — mid grey** |
| `--ink-strong` | `#4a4a4a` | "strong" text — still grey |
| `--muted` | `#b0aeaa` | secondary text/labels |
| `--line` | `#ececea` | borders |
| `--tomato` | `#ff6f61` | primary (coral) |
| accents | `--pink #f4978e`, `--green #8ed1a0`, `--blue #6aa9e0`, `--yellow #f6cf6b`, `--orange #f0a857` | tags/charts |
| `--font` | Quicksand (rounded) | brand typeface |
| headings | `#1f2a22` (hard-coded, not a token) | only genuinely dark text |

## Problems observed (grounded)

### Contrast / legibility (highest impact, accessibility)
- **Body text is grey, not dark.** `--ink #6b6b6b` on `#fff` ≈ 4.4:1 — scrapes
  WCAG AA but reads washed-out; there is no comfortable headline-vs-body contrast
  because `--ink-strong` is only `#4a4a4a`.
- **`--muted #b0aeaa` fails WCAG.** ≈ 2.0:1 on white, used at 0.8–0.9rem for a
  lot of real content: task block-counts, timestamps, section labels, settings
  hints. In the history/main shots this metadata is barely readable.
- Net effect: the UI looks faint and low-hierarchy; everything is a similar grey.

### Typography
- Root was shrunk to **14px (87.5%)**; combined with a rounded face at light
  weight and grey ink, small text (0.8rem ≈ 11px) is hard to read.
- No explicit type scale or weight system — sizes are ad-hoc rem values
  (0.8/0.85/0.9/0.92/0.95/1.15rem). Weak heading↔body weight contrast.

### Layout / UI
- **Stats** and **Settings** strand large empty areas (content not width-capped;
  settings right column mostly blank). The "Pomodoros over time" chart is a big
  near-empty box.
- **History/Today rows** are dense; tiny low-contrast metadata crowds the names.
- Pie/line charts use flat default-ish colors; labels small; no gridlines.

### Visible defect
- **Settings shows raw i18n keys**: a checkbox labelled `settings.notify` with
  hint `settings.notifyHint` — the key exists in code but is missing from
  `frontend/i18n.js` (EN + ZH). Looks broken.

## Direction (recommended)

**Evolve, don't redesign — "legible warm minimalism."** Keep the identity (coral
primary, rounded Quicksand, soft cards, warm bg) and fix the real problems:
contrast first, then a typography scale, then layout polish and the i18n defect.
Low risk: changes are concentrated in `frontend/style.css` + `frontend/i18n.js`
(+ minor `index.html`), no backend.

## Execution Log

- 2026-06-18 04:51 — screenshots + token audit captured; spec authored.
  Plan only (no implementation). Tasks A1–A6 pending.
- 2026-06-18 05:00 — exec. A1 applied (tokens darkened: `--ink #33302b`,
  `--ink-strong #1f2a22`, `--muted #6f6a62`; type-scale tokens added). A3 applied
  (tag chips → soft tinted pill `#eef4fb`/`#2f6aa3`, AA). Mid-exec screenshot
  confirmed a large legibility jump across all views.
- 2026-06-18 05:00 — **A5 drift**: the `settings.notify` leak is a *dead control* —
  `set-notify` has no handler in app.js (`notify`/`Notification` = 0 matches), so
  labelling it would ship a fake toggle. Resolved by **removing** the dead
  checkbox + hint from index.html instead of adding i18n copy. If desktop
  notifications are wanted, that's a separate feature.
- 2026-06-18 05:00 — **A2/A4 judgment (scope trim)**: A1's contrast fix already
  restores the heading↔body hierarchy, so the broad A2 size sweep was **deferred**
  (scale tokens defined in `:root`; no risky global re-typing — respects the 14px
  density choice). A4: tightened the near-empty time-series chart (`.chart-wide`
  200→168px); the settings-form whitespace was **left as-is** — it's a
  conventional left-aligned capped form (620px), and its checkbox-group flow leans
  on load-bearing `grid-column:1/-1` hints that make restructuring high-risk for
  low gain. Recorded as deliberate, not omission.
- 2026-06-18 05:13 — V1 done. Regression: pytest 48, vitest 12, browser e2e
  144/144 (timer 90, task_crud 14, buckets 14, i18n_notes 10, history_delete 16).
  EN+ZH after-screenshots stored in `runs/` confirm contrast/chips/notify-removed
  /tightened chart with no layout regression. All tasks done.
