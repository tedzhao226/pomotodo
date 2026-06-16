# TECH — Pomo de-dup + soft-delete

## Approach

Backend-led: change credit semantics + add a `Block.archived` soft-delete, filter
it (and archived-task blocks) out of History/stats, expose a delete endpoint, then
wire delete controls into the web History view. No timer-engine changes.

### 1. One pomo per session (de-dup)

`backend/repository.py` `credit_block(block_id, task_ids, note)`:

- Close the anchor block (`ended_at = now`), set `completed = True`, `note = note`.
- If the anchor's own task is not in `task_ids` but `task_ids` is non-empty,
  **re-point** `block.task_id` to the first credited id (attribute the session to a
  task that was actually credited — VAL-DEDUP-002).
- **Do not** create extra `Block` rows for the other credited tasks.
- Return `1`.

`backend/service.py` `credit_block` keeps its signature; the `credited` count it
returns becomes `1` (or `0` if the block was missing). Frontend ignores the count.

Consequence: secondary credited tasks no longer each gain a block of progress; the
session is one pomo attributed to one task. Accepted by product.

### 2. `Block.archived` soft-delete

- Migration `alembic/versions/0005_block_archived.py` (revises `0004_block_note`):
  add `blocks.archived BOOLEAN NOT NULL DEFAULT 0` (mirror `0003_task_archived`).
- `backend/models.py`: `Block.archived: Mapped[bool] = mapped_column(Boolean, default=False)`.
- `backend/repository.py`:
  - `archive_block(block_id) -> bool`: set `archived = True`; return False if missing.
  - History/stats queries exclude archived **blocks** only: add
    `Block.archived.is_(False)` to `get_completed_blocks_page`,
    `count_completed_blocks`, `get_task_block_stats`, `get_tag_summaries`,
    `get_completed_blocks`. Do NOT exclude blocks of archived **tasks** — a deleted
    todo keeps its already-logged pomos in history+stats (existing behavior,
    enforced by `test_bucket.py` `*_keeps_history`). [Revised 2026-06-16 after the
    archived-task exclusion broke those tests.]
  - Add `id: int` to `schemas.StatsBlock` so the history pomo response exposes the
    block id over HTTP (the frontend needs it to call `DELETE /api/blocks/{id}`).
- `backend/service.py`: `delete_block(block_id)` → `archive_block`; raise
  `NotFoundError` when missing (mirror `delete_task`).
- `backend/api.py`: `DELETE /api/blocks/{block_id}` → `service.delete_block`,
  204 on success, 404 via the existing error handler. Mirror the task delete route.

### 3. Web History delete UI

`frontend/app.js` + `frontend/index.html` + `frontend/i18n.js`:

- History **pomo** rows (`renderHistory`, ~line 1199): add a `🗑` delete button
  `data-action="delete-pomo" data-id="{block.id}"`. Click → `DELETE /api/blocks/{id}`
  → re-fetch history (and stats if loaded) → re-render.
- History **todo** rows (~line 1241): for non-archived todos add a `🗑`
  `data-action="delete-todo" data-id="{task.id}"`. Click → `DELETE /api/tasks/{id}`
  → re-fetch → re-render (row then shows as deleted).
- Reuse the existing `api()` helper and history fetch/render path. Add i18n keys
  (e.g. `history.deletePomo`, `history.deleteTodo`) in en + zh, matching style.

The block-list payload already exposes `id` via `_block_to_dict`; confirm `id` is
present (it is) so the frontend can target the delete.

## Tests

- `tests/test_block_record.py` — update for the one-pomo model:
  - dedup: crediting A+B → one completed block, note set, no extra rows (VAL-DEDUP-001).
  - attribution: start A, switch/credit only B → one pomo attributed to B; A absent (VAL-DEDUP-002).
  - count: two blocks (one multi-credit) → `count_completed_blocks() == 2` (VAL-DEDUP-003).
  - Keep the existing single-task note + empty-note default cases.
- `tests/test_block_delete.py` (new) — `archive_block`/`delete_block` + filters:
  - soft-deleting a pomo removes it from `get_completed_blocks_page` and keeps the
    row (VAL-PDEL-001).
  - soft-deleted pomo excluded from `count_completed_blocks`, `get_task_block_stats`
    (blocks_done), `get_tag_summaries` (VAL-PDEL-002).
  - archiving a task excludes its blocks from the same stats (VAL-TDEL-001).
  - `delete_block` on a missing id raises `NotFoundError`.
- `tests/e2e_timer.js` — update VAL-REC to the one-pomo model (no second credited
  pomo); add a `VAL-DEL` block: create+complete a pomo, click the History pomo
  delete control, assert it leaves the list and the pomo count drops; delete a
  todo from History and assert it shows deleted. Run via cmux browser eval.

### Test DB

Reuse the existing in-memory sqlite pattern (`tests/conftest.py` `app_transport`
commit-on-yield + StaticPool; `tests/test_block_record.py` service fixture). Backend
service tests use the `Service(Repository(session))` fixture; API tests use
`app_transport`. e2e runs against a clean sqlite-backed uvicorn (create tables via
`Base.metadata.create_all`, no alembic needed for sqlite).

## Verification commands

```bash
uv run pytest tests/test_block_record.py tests/test_block_delete.py -q
uv run pytest -q                                  # full backend suite green
# e2e (host, cmux): start a clean sqlite uvicorn on :8077, open a browser surface,
# eval tests/e2e_timer.js, assert {"failedCount":0}
```

## Risks / open points

- Excluding archived-**task** blocks from stats retroactively lowers totals when a
  todo is deleted (intended per the product decision; note it).
- The de-dup change updates existing VAL-REC assertions (they encoded the old
  multi-pomo behavior) — update, don't just add.
- Alembic head must advance to `0005_block_archived`; sqlite tests use
  `create_all` and are unaffected, but the migration must be correct for Postgres.
- `count_tasks`/`done_todos` already count tasks regardless of archived; leave todo
  *counts* as-is unless a VAL requires otherwise (none does) — scope to block stats.
