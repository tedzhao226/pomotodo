# Tasks: Persist mid-block task state

**Goal**: Persist a running block's active task + touched set on every mid-block
change; restore on rehydrate. Consolidate /assign → PUT /blocks/{id}/tasks.
**Spec Folder**: /Users/ted/workspace/pomotodo/specs/20260618-1522-block-task-sync
**Acceptance**: PRODUCT.md ## Acceptance (VAL-SYNC-001..005)

## Tasks

Execution: serial

```text
tasks[5]{id,title,depends_on,status,size,type,file,contract_refs,acceptance,write_set,backend,run_path,result}:
  B1,BlockTouch model + migration 0009 + repo/service/schema/api (PUT /blocks/{id}/tasks; drop /assign),,done,L,impl,backend/models.py,"VAL-SYNC-001,VAL-SYNC-004","pytest -q","backend/models.py,alembic/versions/0009_block_touches.py,backend/repository.py,backend/service.py,backend/schemas.py,backend/api.py",claude,runs/B1/,
  B2,pytest set_block_tasks + update taskless tests,B1,done,M,test,tests/test_block_tasks.py,"VAL-SYNC-001,VAL-SYNC-004","pytest -q","tests/test_block_tasks.py,tests/test_taskless_block.py",claude,runs/B2/,
  F1,Frontend syncBlockTasks on switch/assign/chip-remove + rehydrate restore,B1,done,M,impl,frontend/app.js,"VAL-SYNC-001,VAL-SYNC-002,VAL-SYNC-003",node --check,frontend/app.js,claude,runs/F1/,
  T1,Playwright block-sync spec,F1,done,M,test,tests/e2e/block-sync.spec.js,"VAL-SYNC-001,VAL-SYNC-002,VAL-SYNC-003",playwright test block-sync,tests/e2e/block-sync.spec.js,claude,runs/T1/,
  V1,Verify no regression,"B2,T1",done,M,review,,VAL-SYNC-005,pytest -q && npm test && npm run e2e,,claude,runs/V1/,
```

All serial: B1 → B2 → F1 → T1 → V1.
```
