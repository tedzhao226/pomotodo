# FINDINGS — syncNow resilience

## Research

- `api()` (app.js:211) throws on `!response.ok` — correct boundary; the 5xx
  propagation is by design.
- `syncNow()` (app.js:727) = `Promise.all([dashboard, stats])` + `catch {}`. Any
  rejection discards both fetches and renders nothing; the error is swallowed.
- App boots with `syncNow()` as the final statement, so a load-time stats 500
  blanks the whole app, not just charts.
- Consumers: `state.dashboard` → task list + timer (core); `state.stats` →
  today-log, sidebar mini-cards, stats charts (secondary). `renderAll` already
  guards `if (!state.dashboard) return` and `if (state.stats) {...}`, so a partial
  buffer renders safely.
- `maybeRehydrateTimer()` sets `state.rehydrated = true` on first call regardless
  of whether `state.dashboard` exists → must be gated on dashboard success, else a
  failed first load permanently disables running-block resume.

## Schema audit (the other follow-up) — CLEAN

Nullable model columns vs their schema surfaces:

| model column (nullable) | schema field | status |
|---|---|---|
| `block.task_id` | BlockStartResponse / BlockResponse / RunningBlock / StatsBlock | all `int \| None` ✅ (StatsBlock fixed in prior spec) |
| `block.ended_at` | `ended_at: str \| None` everywhere | ✅ |
| `task.estimate_blocks` | DashboardTask.estimate_blocks `int \| None` | ✅ |
| `task.blocks_override` | not surfaced (folded into `blocks_done: int`) | ✅ |

`AssignBlockRequest.task_id: int` is a request body (assigning requires a real
task) — correctly non-null. No further schema change needed.

## Execution Log

- 2026-06-17 20:04 — plan written. Scope = single `syncNow` refactor; schema audit
  clean (no backend change). Tasks S1/S2/V1 pending.
- 2026-06-17 20:07 — S1 done (allSettled + warn + gated rehydrate). S2 harness:
  stats-fail keeps dashboard+rows live, stats untouched, warn fired; dash-fail
  updates stats, preserves dashboard, warn fired. V1: e2e 90/0, pytest 48,
  vitest 12. All acceptance met. Done.
- 2026-06-17 20:26 — broadened verify to the **full bh e2e suite** (user ask).
  Initial: timer 90/0, task_crud 14/0, history_delete 16/0; buckets 12/2;
  i18n NO REPORT. Both buckets/i18n failures are **pre-existing test bugs**,
  unrelated to the syncNow change (buckets has no taskless blocks → stats never
  500s → syncNow path identical on full success; i18n crashed on a nav selector
  I never touched). Fixed both as test-debt: buckets reorder/pin "persisted after
  sync" was a race vs the handler's in-flight PATCH → added `syncUntil` (re-sync
  until the server reflects the order); i18n used `[data-view=main]` (renamed to
  view id "pomotodo") and keyed off `nav.main` (the untranslated brand
  "Pomotodo") → switched to `[data-i18n="nav.stats"]` / `nav.stats` (a label that
  actually differs en/zh). Final full suite: **timer 90/0, task_crud 14/0,
  buckets 14/0, i18n 10/0, history_delete 16/0 (144/144).**
- Also added a CLAUDE.md harness reminder: capture the `cmux browser open`
  surface id and `cmux close-surface` exactly it after the run (no orphan
  panels), plus fresh-DB / poll-via-eval / settle gotchas.
