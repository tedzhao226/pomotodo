# Handoff — Tab Title Live Status — 2026-06-16 12:45

## Goal

Mirror the running block into the browser tab title — timer first, then
type (Work/Rest), then task name for work blocks — idle restoring `Pomotodo`.

## Shipped

- `/Users/ted/workspace/pomotodo/frontend/app.js`: added `updateTabTitle()` (read-only
  projection of timer state → `document.title`); called after the two existing
  `els.timerDisplay.textContent` writes (`renderTimer`, `runTicker` tick). No
  timer behavior change.
- `/Users/ted/workspace/pomotodo/frontend/i18n.js`: added `tab.work`/`tab.rest`
  to EN (`Work`/`Rest`) and ZH (`工作`/`休息`).
- `/Users/ted/workspace/pomotodo/tests/e2e_timer.js`: added a self-contained
  `VAL-TAB` block asserting `document.title` across work/rest/paused/idle and
  per-second tracking.

## Acceptance

```text
tasks[2]{id,title,contract_refs,result}:
  T1,Add updateTabTitle helper + i18n + call sites,"VAL-TAB-001..005",done
  T2,Add e2e title checks and run full e2e,"VAL-TAB-001..006",done
```

- VAL-TAB-001: pass — work title `MM:SS · Work: <task>` (e2e check).
- VAL-TAB-002: pass — rest title `MM:SS · Rest`, no task segment (e2e check).
- VAL-TAB-003: pass — paused title prefixed `⏸ `, frozen (e2e check).
- VAL-TAB-004: pass — idle → `Pomotodo` (e2e check).
- VAL-TAB-005: pass — title tracks the per-second countdown (e2e check).
- VAL-TAB-006: pass — full e2e `{"passed":62,"failedCount":0}` (56 baseline + 6 new).

## Verification

- [x] `npm test` → 12/12 (regression guard, unchanged).
- [x] e2e via cmux browser eval on clean sqlite server :8765 → `{"passed":62,"failedCount":0,"failed":[]}`.
- Note: server already sends `Cache-Control: no-cache` (backend/main.py:22), so no `?v=` asset bump was needed.

## Follow-ups

- Work is uncommitted on the default branch (`master`). To protect it, commit on
  a branch (global rule: branch before committing on default; commit only when
  asked). 3 files touched: frontend/app.js, frontend/i18n.js, tests/e2e_timer.js.

## Context

- Branch: master
- Spec: /Users/ted/workspace/pomotodo/specs/20260616-1234-tab-title-status
- Working directory: /Users/ted/workspace/pomotodo
