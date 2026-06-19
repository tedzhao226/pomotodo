# Tasks

Execution: serial

```toon
id,title,depends_on,status,size,type,file,contract_refs,acceptance,write_set,backend,run_path,result
T1,e2e spec for carry + detach,,done,M,test,tests/e2e/break-resume.spec.js,"VAL-BREAK-001,VAL-BREAK-002,VAL-BREAK-003,VAL-BREAK-004",npx playwright test break-resume,tests/e2e/break-resume.spec.js,claude,runs/T1/,4 specs added; afterEach clears server singletons; pending check polled for sync race
T2,carry selection across break + single detach rule,T1,done,M,impl,frontend/app.js,"VAL-BREAK-001,VAL-BREAK-002,VAL-BREAK-003,VAL-BREAK-004",npx playwright test break-resume,frontend/app.js,claude,runs/T2/,carry in finishBlock + completeBlockWithCredit; detach via updateTimerControls prune (selected+pending) on gone/done
T3,regression + full verify,T2,done,S,review,,"VAL-BREAK-001,VAL-BREAK-002,VAL-BREAK-003,VAL-BREAK-004",npx playwright test break-resume skip timer && uv run pytest -q && npm test,,claude,runs/T3/,pytest 52 / vitest 12 / e2e 17 green; updated stale timer-suite VAL8 (credit also-today) + VAL9 (carry)
```

## T1 — e2e spec
Add `tests/e2e/break-resume.spec.js` per TECH.md ## Tests, modeled on `skip.spec.js`
(helpers `gotoApp`, `setSettings`, `stubConfirm`, `addTodo`; freeze countdown via
`state.remainingSeconds`). Covers the four VAL-BREAK ids.

## T2 — impl
`frontend/app.js`: carry `selectedTaskId` at block end in `finishBlock` and
`completeBlockWithCredit`; extend `updateTimerControls` prune to detach `done`/gone
tasks from both `selectedTaskId` and `pendingTaskId`. Align `pendingTaskless` in
`completeBlockWithCredit`.

## T3 — verify
Run the verification commands. All green = done.
