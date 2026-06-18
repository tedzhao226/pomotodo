# Tasks: Skip block into break with 1/3 credit

**Goal**: Skipping a running work block credits it (like a natural end) when
≥1/3 elapsed, else discards (confirm); the break is the user's short/long choice.
**Spec Folder**: /Users/ted/workspace/pomotodo/specs/20260618-1514-skip-block-credit
**Acceptance**: PRODUCT.md ## Acceptance (VAL-SKIP-001..005)

## Tasks

Execution: serial

```text
tasks[3]{id,title,depends_on,status,size,type,file,contract_refs,acceptance,write_set,backend,run_path,result}:
  F1,skipWorkBlockToBreak + completeBlockWithCredit(nextBreak) + wire tabs/skip,,done,M,impl,frontend/app.js,"VAL-SKIP-001,VAL-SKIP-002,VAL-SKIP-003,VAL-SKIP-004",node --check,frontend/app.js,claude,runs/F1/,
  T1,Playwright skip spec,F1,done,M,test,tests/e2e/skip.spec.js,"VAL-SKIP-001,VAL-SKIP-002,VAL-SKIP-003,VAL-SKIP-004",playwright test skip,tests/e2e/skip.spec.js,claude,runs/T1/,
  V1,Verify no regression,"F1,T1",done,M,review,,VAL-SKIP-005,npm run e2e && pytest -q && npm test,,claude,runs/V1/,
```

### F1: implement
`completeBlockWithCredit({nextBreak})`; `skipWorkBlockToBreak`; wire the break-tab
handler + `skipSession`. TECH.md.

### T1: Playwright skip spec
≥1/3 credit (modal → bd+1, streak+1, chosen break), <1/3 discard, ⏭ button.

### V1: Verify
`npm run e2e` (timer + skip green), `pytest -q`, `npm test`.
```
