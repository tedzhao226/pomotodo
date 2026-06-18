# Tasks: Playwright migration

**Goal**: Convert all 5 cmux e2e scripts to Playwright; self-contained, green,
old harness retired.
**Spec Folder**: /Users/ted/workspace/pomotodo/specs/20260618-0644-playwright-migration
**Acceptance**: PRODUCT.md ## Acceptance (VAL-PW-001..005)

## Tasks

Execution: serial

```text
tasks[8]{id,title,depends_on,status,size,type,file,contract_refs,acceptance,write_set,backend,run_path,result}:
  P0,Install Playwright + config + webServer + helpers,,done,M,impl,playwright.config.js,"VAL-PW-001,VAL-PW-002",npm run e2e,"playwright.config.js,tests/e2e/_helpers.js,package.json",claude,runs/P0/,"@playwright/test+chromium; webServer wipes+migrates DB then boots uvicorn; helpers (gotoApp/setSettings/stubConfirm/evalApi/rowAction/addTodo)."
  P1,Convert i18n-notes (prove harness),P0,done,S,impl,tests/e2e/i18n-notes.spec.js,VAL-PW-003,playwright test i18n-notes,tests/e2e/i18n-notes.spec.js,claude,runs/P1/,"2/2. Fixed: settings-view for #set-lang, dispatchEvent row actions, data-id locators."
  P2,Convert task-crud,P0,done,S,impl,tests/e2e/task-crud.spec.js,VAL-PW-003,playwright test task-crud,tests/e2e/task-crud.spec.js,claude,runs/P2/,"2/2. Exact-match regex for substring rename."
  P3,Convert history-delete,P0,done,S,impl,tests/e2e/history-delete.spec.js,VAL-PW-003,playwright test history-delete,tests/e2e/history-delete.spec.js,claude,runs/P3/,"1/1. .nav-btn scope + openHistory() await."
  P4,Convert buckets,P0,done,M,impl,tests/e2e/buckets.spec.js,VAL-PW-003,playwright test buckets,tests/e2e/buckets.spec.js,claude,runs/P4/,"3/3. Synthetic DragEvents + expect.poll re-sync."
  P5,Convert timer (in-page suite),P0,done,L,impl,tests/e2e/timer.spec.js,"VAL-PW-003,VAL-PW-005",playwright test timer,"tests/e2e/timer.spec.js,tests/e2e/_timer-suite.js",claude,runs/P5/,"1/1, 90 checks, 17s. Generated timerSuite() run via page.evaluate; deadline-poke time control."
  P6,Retire old scripts + docs,"P1,P2,P3,P4,P5",done,S,impl,CLAUDE.md,VAL-PW-004,npm test,"CLAUDE.md,tests/e2e_*.js",claude,runs/P6/,"Removed 5 old scripts; CLAUDE.md rewritten for Playwright; package.json e2e script."
  V1,Verify full suite + vitest,"P6",done,M,review,,"VAL-PW-001,VAL-PW-002,VAL-PW-004",npm run e2e && npm test,,claude,runs/V1/,"npm run e2e: 9 passed (24s), self-contained. vitest 12/12."
```

All tasks `done`. See FINDINGS ## Execution Log + HANDOFF.
```
