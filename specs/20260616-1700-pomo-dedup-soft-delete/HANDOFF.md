# Handoff — Pomo de-dup + soft-delete — 2026-06-16

## Goal

Stop one timer block showing as multiple "pomos" in History, and add soft-delete
for pomos and todos from the History view (web app: FastAPI backend + frontend/).

## Shipped

- `/Users/ted/workspace/pomotodo/backend/repository.py`: `credit_block` now produces ONE completed block per session (no extra per-task rows) and re-points the block to a credited task when the anchor's own task is uncredited; added `archive_block`; the five history/stats block queries exclude `Block.archived` (soft-deleted blocks).
- `/Users/ted/workspace/pomotodo/backend/models.py`: `Block.archived` column.
- `/Users/ted/workspace/pomotodo/alembic/versions/0005_block_archived.py`: migration (0004 → 0005) adding `blocks.archived`.
- `/Users/ted/workspace/pomotodo/backend/service.py`: `delete_block` (raises `NotFoundError` on missing id).
- `/Users/ted/workspace/pomotodo/backend/api.py`: `DELETE /api/blocks/{id}` → 204.
- `/Users/ted/workspace/pomotodo/backend/schemas.py`: `StatsBlock.id` exposed (history pomo response carries the block id for the frontend delete).
- `/Users/ted/workspace/pomotodo/frontend/app.js`: History delete-pomo / delete-todo buttons + handler (`DELETE /api/blocks|tasks` → reload history + refresh stats).
- `/Users/ted/workspace/pomotodo/frontend/i18n.js`: `history.deletePomo` / `history.deleteTodo` (en + zh).
- Tests: `tests/test_block_record.py` (one-pomo dedup/attribution/count), `tests/test_block_delete.py` (new — soft-delete + stats exclusion + keeps-todo), `tests/test_bucket.py` (old multi-credit tests updated to one-pomo), `tests/e2e_timer.js` (VAL-REC one-pomo + VAL-DEL).

## Acceptance

tasks[6]{id,title,contract_refs,result}:
  T1,De-dup credit,"VAL-DEDUP-001/002/003",done
  T2,Block soft-delete + DELETE route,"VAL-PDEL-001/002,VAL-TDEL-001",done
  T3,Backend tests,"VAL-DEDUP-*,VAL-PDEL-*,VAL-TDEL-001",done
  T4,Web History delete UI,VAL-UI-001,done
  T5,e2e one-pomo + delete,"VAL-UI-001,VAL-REG-001",done
  T6,Review + full suite,ALL,done

- VAL-DEDUP-001: pass — `pytest test_block_record.py -k dedup` (1) + e2e VAL-DEDUP-001
- VAL-DEDUP-002: pass — `-k attribut` (1); pomo attributed to the credited task
- VAL-DEDUP-003: pass — `-k count` (1); count == real sessions
- VAL-PDEL-001: pass — `test_block_delete.py -k "pomo_soft_delete or history"` (3); row kept, leaves History
- VAL-PDEL-002: pass — `-k pomo_stats` (1); excluded from count/blocks_done/tags
- VAL-TDEL-001: pass — `test_bucket.py -k keeps_history` (2); deleted todo KEEPS its pomos (decision)
- VAL-UI-001: pass — cmux e2e VAL-DEL (delete pomo + todo via real History buttons)
- VAL-REG-001: pass — `uv run pytest -q` 40 passed; cmux e2e 80 passed, failedCount 0

## Verification

- [x] All 8 VAL acceptance commands pass
- [x] `uv run pytest -q` → 40 passed
- [x] cmux browser `tests/e2e_timer.js` → 80 passed, failedCount 0
- [x] Fresh codex review: GATE PASS, migration chain 0004→0005, no bugs
- [x] Changed files all in scope (backend + frontend + tests + migration); no stray edits
- [x] Ledger: 6/6 done, evidence in every runs/T*/

## Follow-ups

- De-dup trade-off (accepted): secondary credited tasks no longer each gain a
  block of progress (`blocks_done`); a session is one pomo attributed to one task.
- TUI (separate `feat/tui` branch) inherits the backend behavior; TUI delete UI
  not added (out of scope). TUI credit sends no note/extra tasks, so unaffected.
- `frontend/index.html` unchanged (History lists render in JS).

## Context

- Branch: feat/pomo-dedup-soft-delete (off master @ 404ddca)
- Spec: /Users/ted/workspace/pomotodo/specs/20260616-1700-pomo-dedup-soft-delete
- Working directory: /Users/ted/workspace/pomotodo
- Mid-exec decision (2026-06-16): deleting a todo keeps its already-logged pomos in
  history+stats (preserves existing keeps-history behavior); the archived-task stats
  exclusion that an initial T2 pass added was reverted.
- Not committed yet.
