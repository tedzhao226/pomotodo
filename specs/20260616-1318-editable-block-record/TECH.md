# Editable Work-Block Record — Approach

## Data model

Add a `note` text column to `blocks`, mirroring the existing `tasks.note`
(`Mapped[str] = mapped_column(Text, default="")`, models.py:30) and its migration
`0002_task_note.py`.

- `backend/models.py` — `Block.note: Mapped[str] = mapped_column(Text, default="")`.
- `alembic/versions/0004_block_note.py` — `down_revision = "0003_task_archived"`;
  `op.add_column("blocks", sa.Column("note", sa.Text(), nullable=False,
  server_default=""))`; downgrade drops it. (sqlite test path uses
  `Base.metadata.create_all`, so the column appears automatically there; the
  migration is for the Postgres deploy.)

The record belongs to the work session, so it is written only to the **anchor
block** (the `block_id` being credited), not to the extra per-task credit rows
that `credit_block` spawns (repository.py:200-222).

## Backend flow

- `backend/schemas.py`:
  - `CreditBlockRequest` → add `note: str = ""`.
  - `StatsBlock` → add `note: str = ""`.
- `backend/repository.py` `credit_block(block_id, task_ids, note)` — set
  `block.note = note` on the anchor block before flush. Extra rows keep `note=""`.
  Include `note` in the **history** pomos row builder that feeds
  `HistoryResponse.pomos` (`StatsBlock`).
- `backend/service.py` `credit_block(block_id, task_ids, note)` — pass through.
- `backend/api.py` credit route — pass `body.note`.

`StatsBlock.note` defaults `""`, so the stats/today-log projection can omit it
(no change there) and old rows stay valid; only the History pomos builder needs
to select it.

## Frontend

### Credit modal (index.html + app.js + i18n.js)

- `index.html`: add one `<input type="text" id="credit-record">` (or textarea)
  inside `#credit-modal` between `#credit-list` and `.modal-actions`.
- `app.js` `openCreditModal(taskIds)`:
  - helper `seedText()` = names of currently-checked boxes joined `" + "`.
  - set the input value to `seedText()` initially.
  - on each checkbox `change`: if not `dirty`, set input value = `seedText()`.
  - on input `input` event: set `dirty = true`.
  - on confirm: resolve with `{ checked, note: input.value.trim() }` (widen the
    promise payload; update the one caller `completeBlockWithCredit`).
- `completeBlockWithCredit` (app.js:1316): send `note` in the credit POST body
  alongside `task_ids`.
- `i18n.js`: add `credit.recordLabel` / placeholder if a label is shown
  (EN + ZH), following the `credit.*` keys.

### Log rendering (app.js) — one line

- `renderHistory` (app.js:1206): replace `escapeHtml(b.task_name)` with
  `escapeHtml(b.note || b.task_name)`.

`b.note` arrives on each history `StatsBlock`; empty falls back to the task name,
so untouched blocks render exactly as today. **today-log (`renderTodayLog`) is
left unchanged** — it aggregates by task and a per-block free-text doesn't fit
that grouping (ponytail: History is the natural per-block home; a Today rewrite
is a separate, bigger change).

## Tests

- `tests/test_block_record.py` (pytest, mirrors tests/test_bucket.py fixtures —
  `create_engine("sqlite://")` + `Base.metadata.create_all` + `Service`):
  - `test_credit_saves_note`: one test — credit a block with `note="..."`, assert
    the anchor block row persisted it and history exposes it; credit another with
    no note, assert it defaults `""` (covers VAL-REC-004 + VAL-REC-006).
- `tests/e2e_timer.js` (in-browser): `VAL-REC` block —
  - open a real credit modal, assert `#credit-record` seeded from checked tasks
    (VAL-REC-001), re-seeds on uncheck (VAL-REC-002), preserves a manual edit
    across a toggle (VAL-REC-003).
  - confirm with a custom record, re-sync, assert the History line shows the
    record not the task name (VAL-REC-005) and a no-note block shows the name
    (VAL-REC-006).

## Verification commands

```bash
pytest -q                       # backend, incl. tests/test_block_record.py
npm test                        # vitest (unaffected; regression)
# e2e against a clean sqlite server (pattern from prior specs):
#   POMOTODO_DATABASE_URL=sqlite:///tmp + Base.metadata.create_all, uvicorn :PORT
SCRIPT=$(cat tests/e2e_timer.js); cmux browser <surface> eval "$SCRIPT"  # {"failedCount":0}
```

## Risks / notes

- Multi-row credit: a 2-task credit still produces 2 block rows; only the anchor
  carries the record, so the secondary task shows as its own named row. This is
  the existing per-task-pomo behavior, just relabeled — flagged for review, not a
  regression.
- Record shows in History only; today-log is untouched (scoped down from the
  first draft — see PRODUCT out-of-scope). Revisit if a per-session Today line is
  wanted.
