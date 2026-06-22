# Findings

## Starting point — existing design system (frontend/style.css :root)

Already a deliberate system, not a blank slate:

- **Color**: `--bg #f3f2ef` warm cream + radial top-glow; `--surface #fff`;
  ink `#33302b`/`#1f2a22`; muted `#6f6a62`; hairline `--line #ececea`. Accents:
  tomato `#ff6f61`, pastel pink/green/yellow/blue/orange (also the JS `PALETTE`).
- **Type**: Quicksand (rounded), `html{font-size:14px}`, scale `--fs-xs…--fs-lg`
  (0.78→1.5rem), weights 400/500/600; body weight 500.
- **Depth**: single soft `--shadow-card`; mint `::selection`.

So "off" is a refinement problem (rhythm, hierarchy, contrast, type tuning), not a
missing theme. Diagnose at token/rule level, not "make it prettier."

## Diagnosis (T1)

Screenshots: `runs/T1/{main,stats,history}.png` (seeded DB, 1280px desktop). Each
issue is bound to a token/rule, not a vague adjective.

### Cross-cutting (the design-system roots of "off")

- **D1 — Hierarchy is flat because size barely varies.** `html{font-size:14px}`
  (style.css:8) compresses the whole rem scale; panel titles are
  `.panel h2{font-size:0.85rem;font-weight:700}` (:189) — only ~11.9px, nearly
  the same as body `--fs-base:1rem`/14px. Headings lean on weight (500→700) instead
  of size to signal rank, so panels read as one undifferentiated block. The real
  scale in use (`--fs-md 1.18rem`, `--fs-lg 1.5rem`) is almost never applied to
  titles.
- **D2 — Two competing heading idioms.** Title-case `.panel h2` (Timer, Todos,
  Today) sits next to UPPERCASE letter-spaced labels — `.bucket-head` (:358),
  `.mini-sub` (:1442), `.kpi-label`/`.range-label` (:1601), `.history-day-head`
  (:567). Same visual rank, two styles → inconsistent.
- **D3 — Tomato is the only accent, so nothing leads.** `--tomato #ff6f61` paints
  brand dot, nav-active (:147), timer, `.mini-value` numbers (:1558), pie slices,
  focus rings, the `▸` backlog caret. With one accent doing everything, no element
  wins the eye. There is a full pastel palette (`--green/--blue/--yellow/--orange`)
  but it's reserved for charts, not hierarchy.
- **D4 — Micro-labels are too small** (~~and muted is too light~~). _Corrected in T3:_
  codex measured `--muted #6f6a62` at **5.37:1 on #fff / 5.19 on #fcfbfa / 4.79 on
  #f3f2ef** — it passes; it is **not** a contrast failure (my "~4.0:1" estimate was
  wrong). The real defect is **type size**: muted is applied to sub-0.75rem text
  repeatedly — `.bar-val{0.6rem}` (:1484), `.mini-week-day{0.62rem}` (:1501),
  `.status-chip{0.68rem}` (:629), `.mini-sub{0.7rem}` (:1443), `.log-time{0.72rem}`
  (:952). Fix = raise the sizes (floor ~0.78rem), not darken the token.
- **D5 — No spacing scale.** Gaps are ad hoc: `main padding:1.6rem`,
  `.main-grid gap:1.25rem`, `.mini-cards gap:14px` (px, off the rem grid, :1379),
  panel padding `1.15rem 1.3rem`, plus a scatter of 0.3/0.35/0.4/0.55/0.65/0.7/0.9rem
  throughout. Nothing snaps to a base unit, so vertical rhythm wobbles.
- **D6 — Quicksand at 700 on tiny headings muddies.** The rounded geometric face
  loses legibility at `0.8–0.85rem` + weight 700; it's a display face being asked
  to do micro-label work.

### Main view (`runs/T1/main.png`)

- **M1 — Tag chips truncate.** `.task-tags{width:96px;overflow:hidden}` (:1071)
  clips two-tag rows: "#writing"→"#writin", "#study"→"#st", "#work"→"#wor". A
  fixed 96px column can't hold two `.tag-chip`s. Visible, real bug.
- **M2 — List metadata is louder than content.** `.tag-chip` (blue `#2f6aa3` on
  `#eef4fb`, :1081) and `.log-tag` (:971) are the most saturated thing in each row,
  so the eye hits the tag before the task name (`.task-name` ink-strong). Hierarchy
  inverted.
- **M3 — Column imbalance leaves dead space.** `.main-grid` is two equal columns
  (:167); the left col (timer + short Today log) ends well above the right col
  (Todos), leaving a large empty rectangle bottom-left before `.mini-cards`.
- **M4 — Two-line timestamps read as noise.** `.log-time` stacks start/end
  (11:25 / 11:00) at 0.72rem muted (:949) — cramped and ambiguous (which is which?).
- **M5 — Vestigial "Timer" title.** Centered `.panel h2` above a 3.6rem display
  number adds a weak label competing with the real focal point.

### Stats view (`runs/T1/stats.png`)

- **S1 — Trend bars are wide, gapless, and pale.** `.bar{fill:var(--pink #f4978e)}`
  (:1704) on `#fcfbfa` is low-contrast; bars nearly touch (no inter-bar gap), so the
  series reads as a wall rather than columns. The Fri zero-gap also breaks the
  rhythm awkwardly.
- **S2 — KPI row floats in whitespace.** 3 `.kpi` items span the full 1040px with no
  separators or grouping (:1611); huge horizontal gaps, weak as a summary band.
- **S3 — Chart panel is mostly empty.** `.chart-wide{height:168px}` (:1645) but bars
  occupy the lower third — lots of dead vertical space above.
- **S4 — Accent overload reaches the pies.** Top-Tags pie leads with the same tomato
  as the brand/nav, so charts don't feel like their own layer.

### History view (`runs/T1/history.png`)

- **H1 — Rows blur together.** `.history-todo`/`.log-item` use `border-top:1px solid
  var(--line #ececea)` (:589, :941) — near-invisible hairlines; long lists read as
  an undifferentiated stripe with no zebra/grouping beyond faint day heads.
- **H2 — Delete affordance is a mystery.** Row `×` sits at `opacity:0.35` muted, far
  right (:1200) — barely visible, no hover hint until you find it.
- **H3 — Same inverted hierarchy as M2.** Blue `#tag` leads every row before the task
  name; metadata louder than content.
- **H4 — Monotone length.** Two stacked full-width panels (Pomos, Todos), the Pomos
  list very tall; nothing chunks it visually except 0.8rem uppercase muted day heads.

## Draft direction — frontend-design skill (T2)

**Central tension the skill surfaced.** The skill names three AI-default looks; #1 is
"warm cream bg (~#F4F1EA) + terracotta accent + rounded display type." The current app
sits *exactly* there: `--bg #f3f2ef` + `--tomato #ff6f61` + Quicksand. So part of why it
reads "off" is that it reads *templated*. But this spec forbids a re-theme (the cream/
tomato system is a deliberate prior commit). The draft's job is therefore the hard one:
**make it stop reading as a default without changing the palette** — spend the freedom on
type, hierarchy, rhythm, and one signature, not on a new color story. That trade is the
key decision T4 + the externals must pressure-test.

### Mood / reference
A **quiet focus instrument**, not a SaaS dashboard. Reference the analog kitchen
pomodoro dial + a well-set paper ledger: warm, calm, disciplined, with exactly one bold
moment (the running timer). The fix is subtraction and precision, not more color.

### Type system (biggest lever — fixes D1/D2/D6)
- **Recast Quicksand to a display-only role**: the timer number, brand, and big stat
  values — where its roundness reads as "friendly tomato timer," on-brief. Stop asking it
  to set 11px/700 micro-labels (D6).
- **Pair a humanist UI/body face** for the dense text (task lists, history, settings,
  labels, legends) with real small-size legibility — candidate **Inter** or **IBM Plex
  Sans**. _Lazy fallback for T4 to weigh: skip the 2nd webfont, keep Quicksand only, and
  fix the scale + weights — cheaper, lower risk, but leaves D6 partly open._
- **Hierarchy by size, not just weight (D1).** Define and actually apply distinct heading
  sizes (use the dormant `--fs-md 1.18rem` / `--fs-lg 1.5rem`); today titles are 0.85rem
  ≈ body. Consider root 14px → 15px to lift the whole compressed scale.
- **One heading idiom (D2).** Title-case for section titles (content); UPPERCASE
  letter-spaced eyebrows *only* for true metadata (RANGE, THIS WEEK) — applied
  consistently, never both for the same rank.

### Color refinement (keep the bones, kill the monoculture — fixes D3/D4/M2/H3)
- **Demote tomato from universal accent.** Reserve `--tomato` for the timer + the one
  primary action. Give structural chrome (nav-active underline, focus ring, backlog caret,
  the `.mini-value` stat numbers) a quiet **ink** treatment instead. Accent ladder:
  tomato = "now / act", ink = "structure", existing pastels = "data only."
- **Raise muted contrast (D4).** `--muted #6f6a62` (~4.0:1) → darker (~`#5c574f`, ≥4.5:1)
  for any *text*; split off a separate faint token used only for chart axes/decoration,
  never body labels. Stop pairing muted with sub-11px sizes.
- **Quiet the list tag chips (M2/H3).** Drop saturated blue `#2f6aa3/#eef4fb` to a neutral
  so the **task name leads** the row, not its metadata.
- **A second, darker divider token** for list grouping where hairline `--line #ececea`
  currently disappears (H1).

### Spacing rhythm (fixes D5)
Introduce a 4px-based spacing scale (`--s1 .25rem … --s6 2rem`) and snap paddings/gaps to
it; kill the off-grid `14px` `.mini-cards` gap (:1379). Vertical rhythm on one base unit.

### Density / layout (fixes M1/M3/H1)
- **Tag column**: replace fixed `width:96px;overflow:hidden` (clips "#writin"/"#st") with a
  flexible/wrapping treatment (M1).
- **Main grid balance**: timer is the hero but doesn't need a full half — try an
  asymmetric grid (e.g. `0.9fr 1.1fr`) or pull `.mini-cards` up to fill the bottom-left
  dead space (M3).
- **History**: stronger row separation + day grouping so long lists chunk (H1/H4).

### Signature element (the one memorable thing)
A **draining dial around the timer**: a tomato progress ring that empties as the pomodoro
runs, wrapping the play button — the analog kitchen-timer made literal. It embodies the
brief, is the single bold accent moment, and replaces the generic "big number" hero with
something specific to *this* product. Everything around it stays quiet.

```
   ┌──────────────────────────┐
   │        Pomodoro          │   tabs (quiet, ink)
   │      ╭──────────╮        │
   │     (   30:00    )       │   ring drains tomato → empty
   │      ╰────▶─────╯        │   play = the one tomato fill
   │     ··· Time to focus    │
   └──────────────────────────┘
```

### The one real risk (justified)
Make the app **calmer and quieter** — strip tomato off everything but the timer/primary
action, lean on paper-like ink + type hierarchy. Risk: under-executed, "quiet" can read
"plain." Justified because the present *busyness* (tomato everywhere + tiny muted labels)
is precisely the diagnosed source of "off." Precision in type + spacing is what keeps quiet
from becoming plain.

### Self-critique ("remove one accessory")
The page currently wears tomato as brand-dot + nav + timer + stat numbers + caret + focus
ring + pie slice. Remove it from the **stat numbers and structural chrome** — the accessory
to take off before leaving the house.

## External perspectives (T3)

Raw replies: `runs/T3/codex.log` (GPT via `codex exec`, screenshots attached with `-i`)
and `runs/T3/cursor.log` (`cursor-agent -p --mode ask`). Both got the diagnosis + draft +
style.css; codex also got the three PNGs as images.

### codex (read the images; ran the contrast math)
- "Palette is coherent. The main problem is compressed hierarchy plus overactive metadata."
- **Corrected my D4**: computed `--muted #6f6a62` = **5.37:1 on #fff / 5.19 on #fcfbfa /
  4.79 on #f3f2ef** — *not* a contrast failure. The real defect is **tiny type**
  (`.bar-val .6rem`, `.mini-week-day .62rem`, `.status-chip .68rem`, `.log-time .72rem`).
- No second webfont — fix sizes + drop tiny-700 weights instead.
- Demote stat numbers to ink, but do it **consistently across tomato/green/blue cards**
  (`.mini-value{color:var(--ink-strong)}`); keep accent on the card rail/dot/chart.
- **Keep tomato on interaction state** (active nav, focus ring, primary action, active
  timer) — removing it there "would weaken coherence."
- **No draining dial** — the 76px tomato `.timer-ctrl-main` already is the signature; a ring
  "mixes progress and action semantics" and adds decoration before hierarchy is fixed.
- **Don't lead with a spacing-token migration** — broad churn; fix the few visibly wrong
  sizes/gaps, extract `--s*` tokens only if repetition proves out.
- Grid: `1fr 1fr`→`0.9fr 1.1fr` **won't** fix M3 — the dead space is the vertical mismatch
  under the tall Todos column, not the ratio.
- First move: keep Quicksand; fix clipped + over-saturated tags; then raise heading +
  micro-label sizes.

### cursor (reasoned from style.css + diagnosis)
- Agreed strongly with D1/D2/D3/M1/M2/H1; **estimated** muted ~4.0:1 (uncomputed — codex's
  measured 5.37 supersedes this).
- Added two I under-weighted: **mini-cards compete with the timer** for "dashboard energy"
  (gradient + 3px rail + hover lift + 2.25rem accent number = four secondary heroes under
  the hero); **timer is triple-framed** (panel → `#fff3f1` bg → vestigial centered h2 →
  tabs pill).
- Nuanced S2: KPI numbers are already ink; the float is `.kpi-row` gaps + `.chart-wide`
  dead air (S3), not tomato.
- Same direction as codex: "ink-led hierarchy; tomato only on live timer state," **no 2nd
  webfont, no dial**. Suggested a thin progress stroke on the play button as the ~20-line
  "kitchen-timer" nod if anything.
- Partial split on demoting tomato: demote off main-view `.mini-value`, but **don't
  ink-wash charts** — `.kpi-value.up` green + pie pastels are correct "data only" use.
- First move: neutralize `.tag-chip`/`#2f6aa3` + unclip `.task-tags`.

### Where they agreed / changed the call
- **Unanimous, changed my draft (T2):**
  - **Drop the 2nd webfont** — keep Quicksand only; the failure is size/weight misuse, not
    the face. (My draft proposed Inter/Plex; both demote it to plan B.)
  - **Drop the draining-dial signature** — the existing 76px tomato play button is the
    signature; at most a thin stroke on it. (Removes my draft's headline "risk.")
  - **Demote spacing-token migration** from a headline to deferred — fix visible offenders
    first, tokenize later only if warranted.
- **codex changed the call on D4** — `--muted` is *not* a contrast failure (measured); the
  fix is raising sub-0.75rem type, not darkening the token. cursor's agreement with my
  wrong estimate is overruled by codex's computation.
- **Unanimous, confirmed my draft:** flat hierarchy via size (apply `--fs-md` to titles,
  weight 700→600); tag clip (M1) + over-saturated tag chips (M2/H3) are the #1/#2 first
  moves; quiet `.mini-value` to ink; stronger history dividers (`#ececea`→~`#dfdcd6`).
- **Open disagreement to resolve in T4:** nav-active color — codex keeps tomato (it's an
  interaction state); cursor would ink it. Also M3: both say the `0.9fr 1.1fr` ratio won't
  fix the dead space — needs a different move (pull `.mini-cards` up) or defer.

## Decisions

- Refinement of the existing token system, **not** a re-theme.
- Exploration only — output is `DIRECTION.md` + change list; implementation is a separate
  spec.

## Execution Log

- 2026-06-22 11:21 — plan written (PRODUCT/TECH/FINDINGS/TASKS). Exploration pipeline,
  4 serial tasks. Sibling spec: 20260622-1121-signoff-countdown.
- 2026-06-22 11:39 — T1 in_progress → done. Seeded throwaway DB (runs/T1/seed.py:
  6 tasks + 18 week-spread blocks), booted uvicorn:8799, captured main/stats/history
  via Playwright (runs/T1/shoot.mjs). Wrote ## Diagnosis: 19 token-bound issues.
  Acceptance glob corrected `runs/*.png` → `runs/T1/*.png` (matches run_path); intent
  (screenshots + diagnosis, VAL-REFRESH-001) satisfied.
- 2026-06-22 11:43 — T2 in_progress → done. DRIFT: plan tier deep→codex, but task is
  "invoke frontend-design (a Claude Code skill)" — codex CLI can't run it; routed to
  host (skill invoked inline). Wrote ## Draft direction; central tension = the current
  cream/tomato/Quicksand look IS AI-default cluster #1, must de-template via type +
  hierarchy + a signature dial without re-theming. acceptance `grep -q Draft` passes.
- 2026-06-22 11:55 — T3 in_progress → done. cursor read OK first try; codex failed once
  (variadic `-i <FILE>...` ate the positional prompt → empty stdin), corrected by piping
  prompt via stdin + keeping `-i` images (same tier, invocation fix, no escalation).
  Both externals independently: drop the 2nd webfont, drop the draining dial, demote
  spacing-token migration to "later." codex computed `--muted` passes contrast → D4
  corrected to a type-size problem. Wrote ## External perspectives. acceptance `ls runs/T3` ok.
- 2026-06-22 11:58 — T4 in_progress → done. Synthesized inline (host) — authoring with full
  context, not fresh-eyes review; codex already contributed as the T3 external. Wrote
  DIRECTION.md: direction "Quiet paper instrument — ink-led hierarchy, tomato reserved for
  live state," external reconciliation, and an 11-item prioritized token-level change list
  (P1–P4) plus 5 explicitly deferred items. All 4 tasks done → ready for /conductor verify.
- 2026-06-22 11:59 — VERIFY → PASS. Fresh clean-context validator (Claude subagent, not
  the codex that shaped T3) read PRODUCT/FINDINGS/DIRECTION + 3 screenshots + style.css.
  VAL-REFRESH-001/002/003 all PASS; D4 self-correction propagated end-to-end; no production
  code shipped (working-tree frontend diff is the sibling signoff-countdown spec, not this
  one — confirmed `.signoff-countdown` markup, none of the refresh change-list targets).
  Ledger reconciled: added runs/T2/ + runs/T4/ evidence pointers (deliverables live in
  FINDINGS/DIRECTION). One non-blocking gap: change-list line numbers drift under concurrent
  edits → fixed by adding a "anchor by selector, not line" note to DIRECTION.md. HANDOFF written.
