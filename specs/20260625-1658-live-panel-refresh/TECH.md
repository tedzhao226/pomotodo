# Tech: Live panel refresh

## Approach

Smallest correct change. One helper + one call site.

### 1. Add `refreshHistoryIfLoaded()` helper

Mirror the existing `refreshStatsIfLoaded()` (line 1365). Place it next to
`reloadHistory()` (~line 1346) / `refreshStatsIfLoaded()`.

Pseudo-code:

```js
// Refresh history only if the tab has been opened this session, so a pomo that
// finishes while history is loaded is reflected without re-opening the tab.
// Uses reloadHistory() (preserves current page), not openHistory() (resets to 0).
async function refreshHistoryIfLoaded() {
  if (state.history) {
    await reloadHistory();
  }
}
```

`reloadHistory()` already preserves `pomoPage` / `todoPage` (it re-fetches at the
current offsets), so VAL-LIVE-004 holds by construction.

### 2. Wire it into `syncNow()` after `renderAll()`

In `syncNow()` (line 764), after the `renderAll()` call at line 785 and before
the `maybeRehydrateTimer()` block:

```js
renderAll();
refreshHistoryIfLoaded();   // fire-and-forget; reloadHistory renders on settle
// ... existing maybeRehydrateTimer guard
```

Rationale for this single lever vs. per-callsite edits:
- Every mutation that affects history (pomo finish/credit) and the 15s periodic
  poll already funnel through `syncNow()`. One hook covers all current and future
  paths.
- Guarded by `state.history`, so it is a no-op until the user opens History — no
  extra fetches on the plain timer/main view.
- Fire-and-forget (not awaited) so it cannot stall `maybeRehydrateTimer` or block
  the caller; `reloadHistory()` renders on its own settle.

`ponytail:` note in the code: this adds a third fetch to `syncNow` only when
history is loaded — one cheap GET; acceptable, upgrade to a diff/versioned
endpoint only if the history payload grows large.

### 3. No backend changes

`/api/dashboard`, `/api/stats`, `/api/history` already exist and return fresh
data. No SSE / WebSocket / polling-rate changes. The 15s `scheduleSync` interval
(line 2352) is unchanged.

## What is intentionally NOT changed

- Cross-tab / multi-device sync — out of scope (user chose same-tab only).
- `reloadHistory()` delete path already calls `refreshStatsIfLoaded()` — leaving
  as-is; not part of this contract.
- No new dependencies, no abstraction over the three endpoints.

## Tests

Playwright e2e (full testing per CLAUDE.md). New spec
`tests/e2e/live-refresh.spec.js`. Reuses the in-page timer machinery from
`tests/e2e/_timer-suite.js` / `_helpers.js` (advance `state.deadline` to complete
a pomo instantly; `page.evaluate` + `expect.poll` for app internals).

Cases (map to VAL-LIVE-*):

1. **VAL-LIVE-001 — add task, no reload:** load main view, add a task via the
   form, `expect(row).toBeVisible()` for the new `data-id`, assert
   `page.evaluate(() => performance.navigation)` / no `nav` event — row appears
   with no navigation. (Regression guard; should pass before and after.)
2. **VAL-LIVE-002 — finish pomo updates today/stats:** start a pomo, advance
   `state.deadline` to completion, credit, then `expect.poll` on the mini-card /
   today-log count via `page.evaluate` — increments with no reload.
3. **VAL-LIVE-003 — finish pomo reaches history:** open History (primes
   `state.history`), return to timer, finish+credit a pomo, then
   `expect.poll(page.evaluate(() => state.history?.pomos?.length))` increases
   without re-opening History and without a reload. This is the case that is red
   before the fix.
4. **VAL-LIVE-004 — page preserved:** open History, paginate to page 2, finish a
   pomo, assert `state.history.pomoPage` is unchanged after the refresh settles.

Conventions (CLAUDE.md):
- Row actions are hover-revealed / overlapped — use `rowAction(scope, action)`
  from `_helpers.js`, not coordinate clicks.
- Locate rows by `data-id`.
- Internals (`state`, `syncNow`) via `page.evaluate` wrapped in `expect.poll`.

## Verification commands

```sh
# New spec alone (fastest signal; red before fix for case 3)
npx playwright test live-refresh

# Full e2e (ensure no regression in timer / task-crud / history-delete)
npm run e2e

# Frontend unit (helpers only; no change expected, run as guard)
npm test
```

## Risks / uncertainty

- **History payload on each sync:** only fetched when `state.history` is truthy
  (History opened once). Cost is one GET per sync; acceptable. Noted with a
  `ponytail:` comment.
- **Fire-and-forget ordering:** `refreshHistoryIfLoaded()` is not awaited so a
  later mutation's `syncNow` could overlap; `reloadHistory()` is idempotent and
  `syncGeneration` already guards dashboard/stats, and history has no equivalent
  race that drops data (each reload is a full page fetch). If a flake appears,
  add a generation check inside `reloadHistory` — defer until observed.

## Added scope: credit the task active at finish (frontend-only)

### Why frontend-only

`credit_block` already repoints `block.task_id` to a single non-anchor task when
the anchor is **not** in the sent `task_ids` (`repository.py:305`). So sending just
the *owner* (and not the stale anchor) makes the backend attribute the pomo to the
task you ended on — **no backend change, no backend-test churn**. The "one pomo =
one block = one task" invariant is untouched (we send exactly one id).

### Change 1 — `completeBlockWithCredit()` sends the owner only

Right before the `/credit` POST (inside the retry loop, after the modal resolves):

```js
// One pomo = one block = one task: credit the task you ended on (the active task
// at finish). If you unchecked it, the first task you left checked owns it. Other
// checked tasks ride along in the note only.
const owner = checked.includes(lastActive) ? lastActive : (checked[0] ?? null);
// ... POST body: { task_ids: owner != null ? [owner] : [], note }
```

`lastActive` is already computed at the top (`state.activeTaskId || block.task_id`).
Empty `task_ids` (nothing creditable checked) keeps the existing anchor — preserves
the documented "uncheck the assigned task, tick only label-only ⇒ stays on the
assigned task" behavior.

### Change 2 — keep the client anchor in sync on first assign

In the `activate` branch of `handleTaskClick`, after `touchedTaskIds.add(taskId)`:

```js
// Mirror the server: the anchor (block.task_id) is set on the first assign to a
// taskless block and never moves on later switches. Keep the client copy in sync
// so completeBlockWithCredit picks the right finish scenario (and a Backlog task
// assigned to a taskless block still shows in the modal).
if (state.activeBlock.task_id == null) {
  state.activeBlock.task_id = taskId;
}
```

This only fires on the first assign to a taskless block (when `task_id` is null) —
it never moves the anchor on later switches, matching `set_block_tasks` and leaving
`block-sync.spec.js` VAL-SYNC-001 (server anchor unchanged) intact.

### What is intentionally NOT changed

- Backend `credit_block` / `set_block_tasks` and their tests — unchanged.
- The server anchor still stays put across switches; only the *credited* task at
  finish changes. The anchor remains the block's start identity / rehydrate key.
- No new auto-break logic — investigation found no separate auto-break defect.

### Tests

New e2e `tests/e2e/credit-active-task.spec.js` (VAL-CREDIT-ACTIVE-001..003).
Doc fix: `docs/timer-states.md` updated so the credit description reads "credits
the task active at finish".
