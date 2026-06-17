# TECH — Aesthetic refresh

Concentrated in `frontend/style.css` (`:root` tokens + a handful of rules),
`frontend/i18n.js` (two keys), and minor `frontend/index.html`. No backend.

## Respect the recent 14px shrink

Commit f695c9d deliberately set the root to **14px (87.5%)** for density. The
faint look is **contrast**, not size — so keep the 14px root and fix contrast +
hierarchy. Only lift the very smallest metadata (0.8rem → ~0.86rem). Do not
re-inflate the global scale.

## 1. Color / contrast tokens (`:root`)

| token | before | after | contrast after |
|---|---|---|---|
| `--ink` (body) | `#6b6b6b` | `#33302b` | ~13:1 on `#fff`, ~11:1 on `--bg` (AAA) |
| `--ink-strong` (headings) | `#4a4a4a` | `#1f2a22` | ~14:1 (unify with the existing hard-coded heading color) |
| `--muted` (secondary) | `#b0aeaa` (≈2:1 ✗) | `#6f6a62` | ~5.0:1 on `#fff`, ~4.6:1 on `--bg` (AA) |

Rules:
- Coral is **decorative / large only**: `--tomato #ff6f61` ≈ 2.6:1 on white — never
  use it for small text. Any coral *text* uses `--tomato-dark #f0594b` and only at
  large/bold sizes (≥3:1).
- Replace the hard-coded `#1f2a22` heading literals with `--ink-strong`.

## 2. Type scale tokens (relative to 14px root)

```css
--fs-xs: 0.78rem;   /* ~11px — micro labels only, never body content */
--fs-sm: 0.86rem;   /* ~12px — secondary metadata (was 0.8rem) */
--fs-base: 1rem;    /* 14px  — body */
--fs-md: 1.18rem;   /* ~16.5px — sub-headings */
--fs-lg: 1.5rem;    /* ~21px — section titles */
--fs-timer: 3.2rem; /* timer digits */
--fw-normal: 400; --fw-medium: 500; --fw-semibold: 600;
```

Apply: headings `--fs-lg/--fw-semibold/--ink-strong`; body `--fs-base/--ink`;
metadata `--fs-sm/--muted`. Replace ad-hoc rem literals on the refreshed surfaces
with these. Nudge `line-height` to ~1.55 and add a hair of `letter-spacing`
(~0.1px) on uppercase section labels (Quicksand reads tight at small sizes).

## 3. Tag chips + charts

- **Tag chips**: stop coloring small text with low-contrast accents. Use a neutral
  tint chip (`--line`-ish bg) + `--ink` text + a small leading accent dot in the
  tag's color. Guarantees ≥4.5:1 and looks cleaner than colored-text-on-tint.
- **Charts**: drive series colors from the accent tokens (coral/green/blue/yellow/
  orange) in a fixed order; add faint gridlines (`--line`); label text in
  `--muted` at `--fs-sm`. Give the near-empty "Pomodoros over time" box a smaller
  fixed height so it doesn't strand space.

## 4. Layout polish

- **Stats / Settings**: cap content width (~`min(100%, 880px)`, centered) so the
  full-bleed cards don't strand whitespace; on Settings, let the form flow in a
  balanced two-column grid that fills, not a half-empty right column.
- **Today / History rows**: +2–3px vertical padding and a clearer name↔metadata
  split so block-counts/timestamps breathe. Keep card padding/radius/shadow
  consistent (one `--radius`, the existing `--shadow-card`).

## 5. i18n defect

Add to `frontend/i18n.js` (EN + ZH). Verify the toggle's real behaviour first
(it gates a desktop notification), then copy, e.g.:

```
EN: "settings.notify": "Notifications",
    "settings.notifyHint": "Show a desktop notification when a pomodoro or break ends."
ZH: "settings.notify": "通知",
    "settings.notifyHint": "番茄钟或休息结束时弹出桌面通知。"
```

## Tests

- Compute contrast for each text/bg pair (VAL-AES-001) — table above is the target.
- Re-screenshot all four views in EN **and** ZH (VAL-AES-003/004) via the cmux
  harness (capture + close the surface per CLAUDE.md); diff against `runs/` before-shots.
- Full regression (VAL-AES-005): `uv run pytest -q`; `npm test`; browser e2e suite
  144/144 (timer/task_crud/buckets/i18n_notes/history_delete).

## Alternatives considered

- *Full restyle / new palette*: rejected — the identity is fine; the problem is
  legibility. Evolve, don't redesign.
- *Bump root back to 15–16px*: rejected — undoes the deliberate density choice
  (f695c9d). Fix contrast instead; revisit size only if legibility is still weak
  after.
- *Dark mode*: out of scope; note as a future follow-up.

## Risks

- Pure CSS/i18n — low risk; the only behavioural surface is the notify toggle copy
  (verify the toggle actually works before labelling it).
- Visual regressions are caught by the before/after screenshot diff, not unit tests.
