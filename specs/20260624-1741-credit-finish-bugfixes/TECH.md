# Tech: credit-on-finish bug fixes

## Approach

Three localized fixes, no schema change.

### BUG-1 — `backend/repository.py` `create_block` (lines 186-201)

The single-open-block sweep currently bulk-updates every open block to
`ended_at=now` (leaving `completed=False`). Replace the bulk UPDATE with a per-block
loop that decides completed vs aborted by elapsed time:

```python
def create_block(self, task_id: int | None, duration_min: int) -> dict:
    # Invariant: at most one open block. Starting a new focus closes any block
    # left running (a failed end, a second tab/device) so two pomos can never be
    # credited out of the same window. A leftover that already ran its full
    # duration is a finished pomo only awaiting credit — keep it (credit its
    # anchor) instead of aborting, so a finished pomo is never silently dropped.
    now = utcnow()
    for leftover in (
        self._session.query(Block).filter(Block.ended_at.is_(None)).all()
    ):
        leftover.ended_at = now
        elapsed = (now - leftover.started_at).total_seconds()
        leftover.completed = elapsed >= leftover.duration_min * 60
    block = Block(task_id=task_id, duration_min=duration_min)
    self._session.add(block)
    self._session.flush()
    return { ... }  # unchanged
```

Note: a leftover credited this way keeps its `task_id` anchor and empty note — it is the
safety-net path (abnormal: a finished block still open when a new one starts). The normal
path still credits through `POST /credit` with the user's chosen tasks/note.

### BUG-2 — `frontend/app.js` `completeBlockWithCredit` (~1510-1545)

Wrap the modal+POST in a retry loop so a failed credit keeps the block and re-opens the
modal (the user's chosen behavior). Compute `modalTaskIds`/`creditableIds` once, then:

```js
let credited = false;
while (!credited) {
  const { checked, note } = await openCreditModal(modalTaskIds, { ... });
  try {
    await api(`/api/blocks/${block.id}/credit`, { method: "POST",
      body: JSON.stringify({ task_ids: checked, note }) });
    credited = true;
  } catch (error) {
    els.timerMode.textContent = t("err.endBlock", { msg: error.message });
    // loop: block stays in state, modal re-opens for retry
  }
}
```

`state.activeBlock` is left untouched on failure (no early `return` that strands it).

### BUG-3 — `frontend/app.js` `renderTodayLog` (line 1051)

```js
const name = b.note || b.task_name;   // was: b.task_name || b.note
```

Matches History's `note || task_name`. Grouping key is unchanged (`b.task_id ?? note:${name}`),
so assigned pomos still group by task; only the displayed label changes.

## Tests

- **BUG-1** → `tests/test_block_record.py` (pytest, Service fixture). Two new tests:
  - finished leftover: start a block, backdate its `started_at` past its duration via
    `service._repo._session`, start a second block, assert the first is `completed=True` and
    `all_time_pomos == 1` (anchor credited).
  - unfinished leftover: covered by existing `test_start_block_closes_previous_open_block`
    (immediate restart → abort, credit rejected); confirm it still passes.
- **BUG-2 + BUG-3** → `tests/e2e/credit-finish-bugfixes.spec.js` (Playwright). Model on
  `skip.spec.js` / `break-resume.spec.js`; complete a block by poking `state.deadline`
  (per CLAUDE.md). 
  - BUG-3: taskless/assigned pomo credited with custom record text → `#today-log` shows the
    note.
  - BUG-2: `page.route('**/credit', ...)` to fail the first POST, assert credit modal
    re-appears and `state.activeBlock` is still set, then let it succeed and assert one pomo.

## Verification commands

```sh
uv run pytest -q tests/test_block_record.py
npx playwright test credit-finish-bugfixes
npx playwright test timer skip break-resume   # regression on the finish/credit neighbours
```
