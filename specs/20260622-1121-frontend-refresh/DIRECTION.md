# Direction — Frontend refresh

Decision document for the UI refinement.
Sources: `FINDINGS.md` (T1 diagnosis, T2 draft, T3 external reads — codex + cursor).
This is a **refinement of the existing token system, not a re-theme**, and **no production
code ships from this spec** — the change list below seeds a follow-up implementation spec.

## Recommended direction

**Quiet paper instrument — ink-led hierarchy, tomato reserved for live state.**

Keep the committed bones: cream `--bg #f3f2ef`, the `--tomato` family, Quicksand, and the
rounded 14–18px geometry. Spend all of the design freedom on **hierarchy and restraint**,
not on new color or new type:

- **Hierarchy by size, one type family.** Keep Quicksand only. Make rank legible through
  size, not weight: apply the dormant larger scale to section titles, drop heavy 700 on
  small labels, and set a micro-label floor. (No second webfont.)
- **An accent ladder, with tomato demoted.** Tomato signals **live / interactive state**
  only — running timer, primary action, active nav, focus, brand mark. Passive numbers and
  structural chrome go **ink**. The pastel palette stays **data-only** (charts/KPIs). One
  accent doing one job is what makes anything stand out.
- **Content leads, metadata whispers.** Neutralize the saturated blue tag chips so the task
  name is the loudest thing in every row.
- **Paper-like lists.** Slightly stronger dividers and grouping so long ledgers chunk.
- **Subtraction over addition.** Remove the vestigial framing (the "Timer" label, the
  over-loud mini-card numbers) rather than adding a new signature. The existing 76px tomato
  play button *is* the signature.

### Rationale

The app reads "off" not because the theme is wrong but because it reads **templated** (it
sits squarely in the common cream+terracotta+rounded look) **and** because hierarchy is
flat: titles are ~11.9px (barely above body), tomato is used for ~7 unrelated things, and
metadata out-shouts content. The cure is precision and restraint — exactly the moves a
refinement (not a re-theme) allows. This direction is also the cheapest correct one: every
change is a token/selector tweak, nothing structural.

## External-review reconciliation

Where codex and cursor **moved the call** from the T2 draft:

- **No second webfont.** Both independently rejected adding Inter/Plex — the failure is
  size/weight misuse of Quicksand, not the face. _Draft's plan-A dropped; single-family
  stays._
- **No new "draining dial" signature.** Both: the 76px tomato play button already is the
  signature; a ring "mixes progress and action semantics" and adds decoration before
  hierarchy is fixed. _Draft's headline risk dropped_ (an optional ~20-line thin progress
  stroke on the play button is the most either would entertain — deferred).
- **D4 was wrong — corrected.** codex *measured* `--muted #6f6a62` at 5.37:1 on #fff (passes
  WCAG); it is not a contrast failure. The real defect is sub-0.75rem **type size**. Fix =
  raise sizes, not darken the token. (My draft and cursor both mis-estimated ~4.0:1; codex's
  computation wins.)
- **Spacing-token migration demoted.** Both: a full `--s1…--s6` pass is broad churn; fix the
  few visibly-wrong gaps now, tokenize later only if repetition proves out.

Where they **confirmed** the draft: flat hierarchy fixed by size; tag clip (M1) + saturated
chips (M2/H3) are the top two first moves; demote `.mini-value` to ink; stronger history
dividers.

Resolved **disagreements**:

- **nav-active color** — codex keeps tomato (it's an interaction state, keeps coherence);
  cursor would ink it. **Call: keep tomato on `.nav-btn.active`.** Tomato = live/interactive
  state is the rule; ink-ing every chrome element risks the "quiet→plain" failure mode.
- **M3 main-grid dead space** — both warn a `0.9fr 1.1fr` ratio won't fix it (the gap is the
  vertical column mismatch). **Call: defer** to a dedicated layout pass; don't ship a ratio
  tweak that doesn't solve it.
- **Don't ink-wash charts** (cursor) — KPI `.up` green and pie pastels are correct data-only
  use. **Call: the ink demotion applies to `.mini-value` + chrome, never chart fills.**

## Change list

Prioritized, token-level, against `frontend/style.css` (+ `frontend/index.html` where
noted). Each P1–P4 row is small enough to be one task in the follow-up implementation spec.

> **Anchor by selector, not line.** Line numbers below are indicative as of T1; `style.css`
> is edited by concurrent work (e.g. the sibling `signoff-countdown` spec), so the numbers
> drift. The follow-up spec should locate each edit by its selector/property.

| #  | P  | Target (selector : line) | Change | Fixes |
|----|----|--------------------------|--------|-------|
| 1  | P1 | `.task-tags` : 1071 | `width:96px;overflow:hidden` → `width:auto; flex:0 1 10rem; flex-wrap:wrap; overflow:visible` (verify row layout vs `.block-badge`/`.row-actions`). | M1 |
| 2  | P1 | `.tag-chip` : 1080 / `.log-tag` : 970 | Drop saturated `#eef4fb`/`#2f6aa3` → `background:#f2efe9; color:var(--muted)`; `.log-tag` weight 700→600, recolor off `--blue`. Leave `.fi-tag` (filter banner is intentionally distinct). | M2, H3 |
| 3  | P2 | `.panel h2` : 187 / `.panel h3` : 194 | `0.85rem/700` → `var(--fs-md)`(1.18rem)/`600`; nudge h3 to ~`1rem`. Rank by size. | D1 |
| 4  | P2 | `.bar-val`:1484 `.mini-week-day`:1501 `.status-chip`:629 `.mini-sub`:1443 `.log-time`:952 | Floor all sub-0.75rem labels at `0.78rem` (`--fs-xs`). (Size, not muted darkening.) | D4 |
| 5  | P2 | `.panel h2` vs `.bucket-head`:358 / `.mini-sub` / `.range-label`:1601 | Pick one idiom: title-case for section titles, UPPERCASE eyebrows only for true metadata. Apply consistently. | D2 |
| 6  | P3 | `.mini-value` : 1558 | `color:var(--accent)` → `color:var(--ink-strong)` for all cards; keep `--accent` on `.mini-dot`/rail/chart only. | D3, mini-card competition |
| 7  | P3 | tomato audit (`.nav-btn.active`:147, focus rings, `button`, `.timer-*`, `.brand-dot`) | Confirm tomato remains only on live/interaction state + brand; nav-active **stays tomato**. (Mostly covered by #6 — verification pass.) | D3 |
| 8  | P3 | `.log-item`:941 / `.history-todo`:589 borders | Add `--line-strong:#dfdcd6`; use it for ledger row separators. | H1 |
| 9  | P4 | `.timer-panel > h2` (index.html:33) | Remove the vestigial centered "Timer" title (`display:none` or drop markup). | M5, timer over-framing |
| 10 | P4 | `.log-item .row-delete` / `.history-todo .row-delete` : 1200 | Raise base discoverability of the `×` (it's `opacity:0.35`) or ensure clear hover reveal. | H2 |
| 11 | P4 | `.mini-cards` : 1379 | `gap:14px` → `gap:1rem` (the one off-grid spacing fix worth doing now). | D5 (partial) |

### Deferred (explicitly NOT first iteration)

- **Full spacing scale (`--s1…--s6`)** — both externals: broad churn; revisit only if the
  ad-hoc gaps keep recurring after P1–P4. (Item 11 takes the single cheap win now.)
- **Main-grid dead space (M3)** — needs a layout pass (pull `.mini-cards` up / narrow the
  timer column); a `0.9fr 1.1fr` ratio won't fix the vertical mismatch.
- **Stats bar wall (S1)** — bar geometry/gaps are computed in `app.js` SVG, not CSS `.bar`;
  out of `style.css` scope, needs a JS chart change.
- **Timer progress stroke** — optional ~20-line thin ring on the play button as the
  "kitchen-timer" nod; only after P1–P4, and only if a signature still feels missing. Not a
  full dial.
- **Root `html` 14px→15px** — would lift the whole compressed scale, but blast radius is the
  entire app; trial it in implementation, behind the size-ladder work (items 3–4), not as a
  blind first move.
