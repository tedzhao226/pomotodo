# Approach

Frontend-only. The server credit endpoint (`POST /api/blocks/{id}/credit`) already
does single-block / single-task attribution (`task_ids[0]` becomes the owner, others
ignored for counting, note saved). We change which checked ids the client sends and
how the modal is composed. No API, model, or migration change.

## app.js — `completeBlockWithCredit` (~1483)

Build the modal input per scenario:

```
touched   = [...state.touchedTaskIds]            # assigned-first
todayIds  = todayCreditCandidates().map(id)
if startedTaskless:                              # Scenario 1 (unchanged behaviour)
  modalTaskIds  = todayIds
  checkedIds    = new Set(touched)
  creditableIds = null                           # null => every checked id can credit
  titleKey      = "credit.titleUntethered"
else:                                             # Scenario 2
  extras        = todayIds without touched
  modalTaskIds  = [...touched, ...extras]
  checkedIds    = new Set(touched)
  creditableIds = new Set(touched)               # only these reach /credit
  titleKey      = "credit.title"
```

`openCreditModal` returns `{ checked, note }` where `checked` is already filtered to
creditable ids; pass it straight to `/credit` as today.

## app.js — `openCreditModal` (~1528)

- New option `creditableIds = null`.
- While rendering rows: the first id that is **not** creditable opens the label-only
  group — emit a `<li class="credit-divider">` with `t("credit.alsoToday")` once, and
  tag those rows `credit-row label-only`.
- On confirm: `note` seeds from **all** checked names (unchanged `seed()`), but the
  returned `checked` = `creditableIds === null ? allChecked : allChecked ∩ creditableIds`.

## i18n.js

Add `credit.alsoToday` (en + zh): "Also worked on today (no credit)" /
"今天也做了（不计入）".

## style.css

`.credit-divider` (muted caption + top border) and `.credit-row.label-only label`
(lighter weight) near the existing `.credit-row` rules (~841).

## docs/timer-states.md

Correct the stale "each checked task earns +1 block" (lines ~8, ~101, ~113) to the
real single-block / single-task + note model, document both finish scenarios, and add
the feature checklist from PRODUCT.md.

## Tests

Backend contract already covered by `tests/test_block_record.py` (single pomo, first-
checked attribution, note). New client-modal composition is verified by screenshots of
both scenarios (server seeded, Playwright). No new pytest needed (no backend change).
Run `uv run pytest -q` to confirm no regression.
