# UI / Logic Refinements — Tech Spec

Product spec: specs/20260613-2214-ui-logic-refinements/PRODUCT.md

## Problem

These refinements touch the timer state machine, the Todos panel markup, the row layout, and the
block-stats query. They must coexist with the buckets/order/notes already in place and keep the
optimistic-sync model intact.

## Relevant Code

- `static/app.js:256` — `renderTimerButton`; idle/running/paused label + primary state + hint.
- `static/app.js:328` — `stopTimer` (async; force-stop ends the block) + Escape handler nearby.
- `static/app.js:910` — `finishBlock(completed)`; PATCHes the block, completion-gated.
- `static/app.js:996-998` — `startSelectedBlock`; `durationMin = state.settings.defaultDuration`.
- `static/app.js:170` — `markdownToHtml`; safe Markdown subset renderer.
- `static/index.html` — timer panel (single `#timer-btn`, `#timer-hint`), Todos panel (inline
  `.add-row` add box inside the Today bucket).
- `static/style.css:415` — `#timer-btn` (+ `.primary`); `:227` `.add-row`; `:639` `.task-tags`,
  `.block-badge`, `:673` `.row-actions` (fixed-width columns); `:750` `.note-panel`.
- `app/repository.py:179,200` — `get_task_block_stats` / `get_tag_summaries` filter
  `Block.completed.is_(True)`.

## Current State

All six refinements are implemented and verified this session:
- Single timer button with hold/Escape stop; duration from settings; inline boxed add input;
  per-task Markdown notes; fixed-width tag/badge/action columns; completed-only block counting.
- `tests/test_bucket.py:71` covers completed-only counting; the suite is green
  (`uv run pytest` → 17 passed) and `node --check static/app.js` is clean.

## Implementation

(Already shipped — recorded here as the contract.)
- Timer: `state.mode` drives `renderTimerButton`; click toggles start/pause/resume; a `pointerdown`
  timer (≥550ms) and an `Escape` keydown call `stopTimer`, which ends the block with
  `completed = remainingSeconds <= 0`; `pointercancel`/`pointerleave` cancel the hold; a `didHold`
  flag suppresses the trailing click.
- Duration: `startSelectedBlock` reads `state.settings.defaultDuration`; the dropdown was removed.
- Add box: the `#add-task-form` lives inside the Today bucket as `.add-row` (`+` prefix, focus-ring,
  Enter submits).
- Notes: `note` column (Alembic `0002_task_note`) → editor textarea → `markdownToHtml` panel toggled
  by a per-row 🗒 button (`state.expandedNoteId`).
- Alignment: `.task-tags` (96px), `.block-badge` (52px), `.row-actions` (116px) are fixed-width; the
  name (`flex:1`) absorbs slack so columns align; the move control is icon-only on hover.
- Counting: per-task and per-tag stats filter `completed = true`, so force-stopped blocks don't count.

## Edge Cases

- Keyboard users stop via Escape (hold-to-stop is pointer-only).
- A failed end-block PATCH keeps `activeBlock` so a new block can't start over an open one.
- Switching/moving a task with an open editor preserves the editor against background sync.
- Notes render only an escaped, http(s)-only Markdown subset (no raw HTML injection).

## Tests

- `uv run pytest` (includes `test_only_completed_blocks_count_toward_task`).
- `node --check static/app.js`.
- Manual: start→pause→resume→hold/Escape stop; add via the inline box; add/view a Markdown note;
  confirm tag/badge/action columns align; force-stop leaves the done count unchanged.
