# Tasks: syncNow resilience

**Goal**: Decouple dashboard/stats sync and surface failures so one bad endpoint
can't blank the app or hide a 5xx.
**Spec Folder**: /Users/ted/workspace/pomotodo/specs/20260617-2004-syncnow-resilience
**Acceptance**: PRODUCT.md ## Acceptance (VAL-SYNC-001..004)

## Tasks

Execution: serial

```text
tasks[3]{id,title,depends_on,status,size,type,file,contract_refs,acceptance,write_set,backend,run_path,result}:
  S1,Refactor syncNow to allSettled + warn + gated rehydrate,,done,S,impl,frontend/app.js,"VAL-SYNC-001,VAL-SYNC-002,VAL-SYNC-003",node --check,frontend/app.js,claude,runs/S1/,Promise.allSettled; independent slice assignment; console.warn on each rejection; rehydrate gated on dashboard success.
  S2,Browser harness checks for partial-failure isolation,S1,done,S,test,,"VAL-SYNC-001,VAL-SYNC-002,VAL-SYNC-003",cmux browser eval,,claude,runs/S2/,stats-fail: dashboard+rows render, stats untouched, warn fired. dash-fail: stats update, dashboard preserved, warn fired. All pass.
  V1,Verify no regression,S1,done,M,review,,VAL-SYNC-004,pytest -q && npm test,,claude,runs/V1/,e2e 90/0; pytest 48; vitest 12.
```

### S1: Refactor syncNow
Replace `Promise.all`+silent-catch with `Promise.allSettled`, independent slice
assignment, `console.warn` on each rejection, and `maybeRehydrateTimer()` gated on
dashboard success. See TECH.md.

### S2: Partial-failure harness checks
On a live server: stub global `api` to reject for `/api/stats`, run `syncNow()`,
assert `state.dashboard` set + task rows render + `console.warn` fired + stats
untouched. Repeat with `/api/dashboard` failing. Restore `api`.

### V1: Verify no regression
Full `tests/e2e_timer.js` `failedCount: 0`; `uv run pytest -q`; `npm test`.
```
