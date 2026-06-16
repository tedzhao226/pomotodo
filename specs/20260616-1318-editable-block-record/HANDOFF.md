# Handoff — Editable Work-Block Record — 2026-06-16 15:09

## Goal

Add an editable free-text record to the work-block credit modal, seeded from the
checked task names, saved on the block, and shown in the History list in place of
the task name.

## Shipped

- `backend/models.py` + `alembic/versions/0004_block_note.py` — `blocks.note`
  column (Text, default "").
- `backend/schemas.py` — `CreditBlockRequest.note`, `StatsBlock.note`.
- `backend/repository.py` — `credit_block(.., note)` writes the note to the anchor
  block only; `_block_to_dict` exposes `note` (history + stats share it).
- `backend/service.py`, `backend/api.py` — pass `note` through.
- `frontend/index.html` — `#credit-record` input + sr-only label.
- `frontend/app.js` — `openCreditModal` seeds the record from checked tasks,
  re-seeds on toggle until a manual edit (dirty flag), resolves `{checked, note}`;
  `completeBlockWithCredit` POSTs `note`; `renderHistory` renders `note ||
  task_name`. today-log untouched.
- `frontend/i18n.js` — `credit.record` (EN+ZH).
- `frontend/style.css` — `.sr-only`, `.credit-record`.
- `tests/test_block_record.py`, `tests/e2e_timer.js` — coverage.

## Acceptance

```text
tasks[5]{id,title,contract_refs,result}:
  B1,Backend blocks.note end-to-end,"VAL-REC-004,006",done
  B2,Pytest credit-with-note,"VAL-REC-004,006",done
  F1,Frontend record input + History line,"VAL-REC-001,002,003,005,006",done
  E1,e2e VAL-REC,"VAL-REC-001,002,003,005,006",done
  V1,Validate,"VAL-REC-001..007",done
```

- VAL-REC-001 seed from checked — pass (e2e).
- VAL-REC-002 re-seed on uncheck — pass (e2e).
- VAL-REC-003 manual edit preserved — pass (e2e).
- VAL-REC-004 saved to block — pass (pytest test_credit_saves_note).
- VAL-REC-005 record replaces task name in History — pass (e2e).
- VAL-REC-006 no-note shows task name — pass (pytest + e2e).
- VAL-REC-007 no regression — pass (pytest 72/72, e2e 74/0).

## Verification

- [x] `pytest -q` → 72 passed (incl. tests/test_block_record.py).
- [x] `npm test` → 12/12.
- [x] e2e on clean sqlite server → `{"passed":74,"failedCount":0}`.

## Follow-ups

- today-log (Today view) deliberately NOT changed — record shows in History only
  (ponytail-scoped). Revisit if a per-session Today line is wanted.
- Multi-row credit: a 2-task credit still makes 2 block rows; only the anchor
  carries the record, so a secondary credited task shows as its own named row.
  Existing per-task-pomo behavior, just relabeled.
- Uncommitted on `master` (alongside the still-uncommitted TUI work). Commit the
  feature when ready.

## Context

- Branch: master
- Spec: /Users/ted/workspace/pomotodo/specs/20260616-1318-editable-block-record
- Working directory: /Users/ted/workspace/pomotodo
