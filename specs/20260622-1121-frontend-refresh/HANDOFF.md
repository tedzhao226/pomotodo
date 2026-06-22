# Handoff — Frontend refresh: direction exploration — 2026-06-22 11:59

## Goal

Pin down what specifically reads as "off" in the existing UI and decide one intentional
refinement direction (informed by the `frontend-design` skill + codex/cursor reviews) — an
exploration spec whose deliverable is a decision doc + change list, **no production code**.

## Shipped

- `/Users/ted/workspace/pomotodo/specs/20260622-1121-frontend-refresh/FINDINGS.md`: T1
  token-level diagnosis (19 issues), T2 draft direction, T3 distilled external perspectives,
  append-only Execution Log.
- `/Users/ted/workspace/pomotodo/specs/20260622-1121-frontend-refresh/DIRECTION.md`: the
  deliverable — recommended direction "Quiet paper instrument — ink-led hierarchy, tomato
  reserved for live state," external-review reconciliation, and an 11-item prioritized
  token-level change list (P1–P4) + 5 justified deferrals.
- `runs/T1/` (git-ignored): seed.py, shoot.mjs, main/stats/history screenshots.
- `runs/T3/` (git-ignored): codex.log, cursor.log, prompt.md.
- No `frontend/` code changed by this spec (exploration only).

## Acceptance

tasks[4]{id,title,contract_refs,result}:
  T1,Capture screenshots + diagnose tokens,VAL-REFRESH-001,done
  T2,Apply frontend-design skill draft,VAL-REFRESH-002,done
  T3,Gather codex + cursor perspectives,VAL-REFRESH-002,done
  T4,Synthesize DIRECTION + change list,"VAL-REFRESH-002,VAL-REFRESH-003",done

- VAL-REFRESH-001: pass — 3 screenshots present; FINDINGS ## Diagnosis lists 19 issues each
  bound to a token/selector; spot-checks (html:8, .panel h2:187, .task-tags) confirmed real.
- VAL-REFRESH-002: pass — DIRECTION.md states one direction + rationale; reconciliation
  records 4 calls the externals changed, confirmations, and 3 resolved disagreements.
- VAL-REFRESH-003: pass — 11-row token-level change list, refinements not rewrite, each one
  follow-up task; 5 deferrals justified.

## Verification

- [x] `ls runs/T1/*.png` (3 screenshots)
- [x] `grep -q Draft FINDINGS.md`
- [x] `ls runs/T3`
- [x] `ls DIRECTION.md`
- [x] No production code shipped — style.css change-list targets all unapplied; working-tree
  frontend diff belongs to sibling `signoff-countdown` spec (`.signoff-countdown` markup).
- [x] Fresh clean-context validator: PASS on all VALs + internal consistency.

## Follow-ups

- Spin up the implementation spec from DIRECTION.md ## Change list. Start P1 (unclip
  `.task-tags`, neutralize `.tag-chip`/`.log-tag`).
- **Anchor edits by selector, not the cited line numbers** — they drift as concurrent specs
  edit `style.css` (noted in DIRECTION.md).
- Item 7 ("tomato audit") is a verification checklist overlapping item 6 — treat as a check,
  not a standalone edit. Items 1 + 9 carry layout caveats needing a live check.
- Deferred (not first iteration): full `--s*` spacing scale, M3 grid layout pass, S1 stats
  bar gaps (JS/SVG in app.js), optional play-button progress stroke, root 14→15px trial.

## Context

- Branch: master
- Spec: /Users/ted/workspace/pomotodo/specs/20260622-1121-frontend-refresh
- Working directory: /Users/ted/workspace/pomotodo
