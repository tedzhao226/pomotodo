# Frontend refresh — direction exploration

## Intent

The UI "always seems a bit off." There is already a deliberate design system
(`:root` tokens: warm cream bg, Quicksand rounded type, tomato/pastel palette, a 14px
type scale — from the prior `20260618-0451-aesthetic-refresh`). So this is **not** a
from-scratch theme. The goal is to pin down *what specifically reads as off* and decide a
single, intentional refinement direction — informed by the `frontend-design` skill and by
external-agent perspectives (codex + cursor) — before any code is written.

This spec is **exploration only**. Its deliverable is a decision document and a prioritized
change list, which seeds a separate implementation spec. No production CSS/markup ships
from this folder.

## Acceptance

### VAL-REFRESH-001: Current state captured and diagnosed
Given the running app.
When the main, stats, and history views are screenshotted and the current `:root` design
tokens are inventoried.
Then `runs/` holds the screenshots and `FINDINGS.md` lists concrete "off" issues, each
tied to a token or rule (typography, spacing/rhythm, color, hierarchy) — not vague
adjectives.
Evidence: screenshots present + FINDINGS diagnosis section

### VAL-REFRESH-002: One recommended direction, externally reviewed
Given the diagnosis.
When the `frontend-design` skill guidance is applied and at least two external-agent
perspectives (codex and cursor) on the current screenshots + draft are gathered.
Then `DIRECTION.md` states one recommended direction (mood, type system, color, spacing
rhythm) with rationale, and explicitly records where the external reviews agreed / changed
the call.
Evidence: specs/.../DIRECTION.md

### VAL-REFRESH-003: Prioritized first-iteration change list
Given the chosen direction.
When it is reduced to concrete edits.
Then `DIRECTION.md` ends with a prioritized, token-level change list against
`frontend/style.css` + `frontend/index.html` (refinements, not a rewrite), each item
small enough to become one task in a follow-up implementation spec.
Evidence: DIRECTION.md ## Change list
