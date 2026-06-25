# Findings: Live panel refresh

## Relevant Files

- `frontend/app.js:744` — `renderAll()`: renders dashboard/today-log/mini-cards/stats. **No history.**
- `frontend/app.js:764` — `syncNow()`: fetches `/api/dashboard` + `/api/stats` only; generation-guarded (commit `2f2220e`).
- `frontend/app.js:877` — `scheduleSync(delay=600)`: debounced wrapper around `syncNow()`.
- `frontend/app.js:1284` — `fetchHistory()`: hits `/api/history`.
- `frontend/app.js:1291` — `openHistory()`: resets to page 0, loads both sections. Called on route→history (`applyRoute` line 234).
- `frontend/app.js:1346` — `reloadHistory()`: re-fetches at current offsets (preserves page). Called only by in-tab delete (1991/2005).
- `frontend/app.js:1365` — `refreshStatsIfLoaded()`: guarded refresh helper — the pattern to mirror.
- `frontend/app.js:1390` — `renderHistory()`.
- `frontend/app.js:1871` — add-task submit → POST + `syncNow()`.
- `frontend/app.js:2050` — `handleTaskClick()`: row actions (pin/move/delete/toggle/edit/save/activate/note/filter).
- `frontend/app.js:~1556 / ~1634` — `endBlock` / `completeBlockWithCredit` → `syncNow()`.
- `tests/e2e/_timer-suite.js`, `tests/e2e/_helpers.js` — in-page timer machinery + `rowAction()` helper to reuse.

## Discoveries

- Every task mutation already live-refreshes: add (syncNow), pin (optimistic + syncNow), move/delete/toggle (optimistic + scheduleSync 600ms), save (syncNow). Confirmed at lines above.
- Pomo finish (endBlock, completeBlockWithCredit) calls `syncNow()` → dashboard/today-log/mini-cards/stats update. Confirmed.
- The task-add vanishing race was fixed 2h ago in `2f2220e` (generation token in `syncNow`).
- **The only structural gap: history is outside the syncNow/renderAll path.** History loads on tab open (`openHistory`, resets page) or in-tab delete (`reloadHistory`). A finished pomo never triggers a history reload.
- `reloadHistory()` preserves pagination; `openHistory()` resets to page 0. So the live-refresh helper must call `reloadHistory()`, not `openHistory()`.
- There is already a guarded-refresh idiom — `refreshStatsIfLoaded()` (1365) — used after history deletes. Mirror it for history.

## Knowledge Updates

- "Reflect new data without refresh" in this single-tab app is delivered by the in-page `syncNow()` path, not by push. Any panel not covered by `renderAll()` + not re-fetched in `syncNow()` is a live-refresh gap. History was that gap.

## Drift

- None between plan and repo. Initial assumption ("maybe tasks don't appear") was superseded by finding the task path was fixed in `2f2220e`; the real gap is history only.

## Durable Candidates

- (none yet — execution pending)

## Execution Log

Append-only — status history; do not overwrite.

### [2026-06-25 16:58] plan authored
- status: (plan mode — no task dispatched yet)
- backend: claude
- contract_refs: VAL-LIVE-001..004
- tests_run: not run
- evidence: spec folder created; audit complete; root cause = history excluded from syncNow/renderAll.
- run_path: (n/a)

### [2026-06-25 17:30] pre-exec audit + scope extension (replanned)
- status: T1,T2,T4,T5,T3 = pending (T4/T5 added)
- backend: claude (host-direct; investigation workflow wf_476baa20-c41, 5 agents)
- contract_refs: VAL-LIVE-001..004, VAL-CREDIT-ACTIVE-001..003
- tests_run: scratch repro tests/e2e/_repro-credit.spec.js — REPRO A/B/C green, REPRO D (start A→switch B→default confirm) RED: B credited 0, A keeps the pomo. Confirms the bug.
- evidence:
  - Plan audit: live-refresh plan valid as-is; line numbers accurate; root cause holds; fix minimal; no regression. Execute T1/T2 unchanged.
  - Credit bug root cause: one pomo = one block = one task (block.task_id). Backend keeps anchor when anchor ∈ checked (repository.py:305); modal pre-checks all touched (app.js:1599) → start anchor wins over the switched-to task. Compounded by stale client state.activeBlock.task_id (never updated after mid-block assign; app.js startBlock 1490 only) → taskless+assign mis-routes to Scenario 1 and a Backlog assign is filtered out of the modal (todayCreditCandidates app.js:619).
  - Both finder hypotheses were adversarially REFUTED on the haiku verify pass; ground-truthed by orchestrator reading prior specs (20260619-0630-pomo-finish-credit) + writing/running the repro.
  - Auto-break: NO separate defect. #credit-modal is a real blocking overlay (style.css:811 position:fixed;inset:0;z-index:50). credit-registers.spec.js already proves finish-credit with autoStartRest on. User's "auto break" association explained by auto-start seeding the next pomo on the old task.
  - User decision: credit the task ACTIVE AT FINISH; others note-only. Fix is frontend-only (send task_ids=[owner], owner=active-at-finish; + client anchor sync on first assign).
- run_path: (n/a — host-direct)

### [2026-06-25 18:25] exec complete — all tasks done
- status: T1,T2,T4,T5,T3 = done
- backend: claude (host-direct)
- contract_refs: VAL-LIVE-001..004, VAL-CREDIT-ACTIVE-001..003
- tests_run:
  - `npx playwright test live-refresh` → 4/4 green (003 was red before T2).
  - `npx playwright test credit-active-task` → 5/5 green (001/002b/003 were red before T5).
  - `uv run pytest -q` → 58 passed (no backend change).
  - `npm test` (vitest) → 18 passed.
  - `npm run e2e` → 39 passed (full regression).
- evidence:
  - Live refresh: `refreshHistoryIfLoaded()` added next to `refreshStatsIfLoaded()`; called fire-and-forget in `syncNow()` after `renderAll()`. Uses `reloadHistory()` (preserves page) — VAL-LIVE-004 holds.
  - Credit: `completeBlockWithCredit()` POSTs `task_ids=[owner]` where `owner = checked.includes(lastActive) ? lastActive : checked[0] ?? null`; `handleTaskClick` `activate` syncs `state.activeBlock.task_id` on first assign. No backend change.
  - Regression surfaced + resolved: `_timer-suite.js` VAL-DEDUP-001 asserted the old anchor-wins attribution (`task_id === aId`); updated to the new contract (attributed to B = active at finish; A note-only; still exactly one pomo). The dedup invariant (`recPomos.length === 1`) was unchanged.
  - Docs: `docs/timer-states.md` updated (credit = task active at finish); superseding note added to `specs/20260619-0630-pomo-finish-credit`.
  - Scratch `tests/e2e/_repro-credit.spec.js` removed.
- run_path: (n/a — host-direct)
- next: /conductor verify
