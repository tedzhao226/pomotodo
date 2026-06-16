# Findings: Editable Work-Block Record

## Relevant Files

- `backend/models.py` — `Block` (57-73) has no note; `Task.note` (30) is the
  pattern to mirror (`Text, default=""`).
- `backend/repository.py` — `credit_block` (200-222) closes the anchor block and
  spawns one completed row per extra touched task; this is where the note is
  written (anchor only). Stats/history row builders here feed `StatsBlock`.
- `backend/service.py` `credit_block` (109) / `backend/api.py` credit route (138)
  — thin pass-through to widen with `note`.
- `backend/schemas.py` — `CreditBlockRequest` (51), `StatsBlock` (99) to extend.
- `alembic/versions/0002_task_note.py` — exact template for the new
  `0004_block_note.py`; head is `0003_task_archived`.
- `frontend/index.html` — credit modal (270-278): `#credit-list` + confirm; add
  the record input here.
- `frontend/app.js` — `openCreditModal` (1348-1380) builds the checklist and
  resolves checked ids; `completeBlockWithCredit` (1316) posts credit;
  `renderHistory` (1206) and `renderTodayLog` (943-) render the per-block label.
- `tests/test_bucket.py` — sqlite `Service` fixture pattern for the new pytest.
- `tests/e2e_timer.js` — in-browser checks (currently 67).

## Discoveries

- Credit is per-task: the anchor block row is reused for its own task; each other
  touched+checked task gets a fresh `completed=True` block row of the same
  length. So "one work session" can be several block rows. The record is a
  session concept → store it on the anchor row only.
- History (`renderHistory`) is per-block — natural home for the record (one-line
  change). today-log (`renderTodayLog`) groups by `task_id`; a per-block
  free-text doesn't aggregate there, so it's left unchanged (ponytail review cut
  the today-log rewrite — see Drift).
- The sqlite test path uses `Base.metadata.create_all`, so tests pick up the new
  column without running alembic; the migration is purely for the Postgres
  deploy (Dockerfile entrypoint runs `alembic upgrade`).
- Dashboard per-task pomo counts come from `blocks_done` / `get_task_block_stats`
  (a separate completed-block aggregation), untouched by the note.

## Knowledge Updates

- `tasks.note` already exists and is surfaced; `blocks.note` is a parallel,
  symmetric addition.

## Drift

- None vs user intent. Confirmed choices: record **replaces** the task name in
  the logs; prefill from **currently-checked** tasks, live-updating until a
  manual edit.
- Ponytail review (2026-06-16) trimmed the plan 7→5 tasks: dropped the today-log
  grouping rewrite (record shows in History only), merged backend into one task,
  collapsed two pytest tests into one. User approved. Open: revisit Today-log
  display only if a per-session line there is wanted.

## Durable Candidates

- None yet.

## Execution Log

Append-only. One entry per status transition.

### [2026-06-16 13:30] B1 — in_progress → done

- status: done
- backend: claude
- contract_refs: VAL-REC-004, VAL-REC-006
- tests_run: `pytest -q` → 71/71 passed.
- evidence: `Block.note` column + alembic `0004_block_note`; `CreditBlockRequest.note`
  + `StatsBlock.note`; `credit_block(note)` sets note on the anchor block only;
  `_block_to_dict` exposes `note` (shared by history pomos + stats). Both builders
  share `_block_to_dict`, so one change covers both — note still displayed only in
  History per plan.
- run_path: runs/B1/

### [2026-06-16 15:00] B2 — in_progress → done

- status: done
- backend: claude
- contract_refs: VAL-REC-004, VAL-REC-006
- tests_run: `pytest -q tests/test_block_record.py` → 1 passed.
- evidence: `test_credit_saves_note` — credit a block with a note, history `note`
  matches; credit without a note, `note == ""`.
- run_path: runs/B2/

### [2026-06-16 15:04] F1 — in_progress → done

- status: done
- backend: claude
- contract_refs: VAL-REC-001, VAL-REC-002, VAL-REC-003, VAL-REC-005, VAL-REC-006
- tests_run: `npm test` → 12/12 (regression; behavior verified in E1).
- evidence: `#credit-record` input (sr-only label) seeds from checked task names,
  re-seeds on toggle until a manual edit (dirty flag); `openCreditModal` resolves
  `{checked, note}`; `completeBlockWithCredit` POSTs `note`; `renderHistory`
  renders `note || task_name`; today-log untouched. `.sr-only`/`.credit-record`
  styles added.
- run_path: runs/F1/

### [2026-06-16 15:05] E1 — in_progress → done

- status: done
- backend: claude
- contract_refs: VAL-REC-001, VAL-REC-002, VAL-REC-003, VAL-REC-005, VAL-REC-006
- tests_run: full e2e via cmux on a clean sqlite server →
  `{"passed":74,"failedCount":0}` (67 baseline + 7 new VAL-REC checks).
- evidence: VAL-REC block drives a real credit modal — seed `A + B`, re-seed on
  uncheck → `A`, manual edit preserved across a toggle; confirm a custom record,
  `openHistory`, assert the anchor (A) pomo `note` == record and renders it, the
  extra (B) pomo `note == ""` and renders the task name.
- run_path: runs/E1/

### [2026-06-16 15:08] V1 — in_progress → done

- status: done (PASS)
- backend: claude
- contract_refs: VAL-REC-001..007
- tests_run: `pytest -q` → 72 passed (incl. tests/test_block_record.py); e2e
  `{"passed":74,"failedCount":0}`.
- evidence: VAL-REC-001/002/003/005 via e2e; VAL-REC-004/006 via pytest + e2e;
  VAL-REC-007 = both suites green. All acceptance ids satisfied.
- run_path: runs/V1/
