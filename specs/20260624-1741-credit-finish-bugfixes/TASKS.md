# Tasks: credit-on-finish bug fixes

**Goal**: A finished pomo always credits its task. Fix BUG-1 (silent abort of finished
leftover), BUG-2 (credit failure strands block), BUG-3 (Today log hides record note).
**Spec Folder**: /Users/ted/workspace/pomotodo/specs/20260624-1741-credit-finish-bugfixes
**Acceptance**: ./PRODUCT.md (## Acceptance, VAL-BUG*)

## Tasks

Execution: serial

```text
tasks[5]{id,title,depends_on,status,size,type,file,contract_refs,acceptance,write_set,tier,run_path,result}:
  T1,BUG-1 create_block keeps finished leftover,,done,S,impl,backend/repository.py,"VAL-BUG1-001,VAL-BUG1-002",uv run pytest -q tests/test_block_record.py,backend/repository.py,standard,runs/T1/,per-block sweep: completed=elapsed>=duration
  T2,BUG-1 backend tests,T1,done,S,test,tests/test_block_record.py,"VAL-BUG1-001,VAL-BUG1-002",uv run pytest -q tests/test_block_record.py,tests/test_block_record.py,standard,runs/T2/,finished-leftover credited + unfinished still aborts
  T3,BUG-2 credit retry + BUG-3 note display,,done,S,impl,frontend/app.js,"VAL-BUG2-001,VAL-BUG3-001","npx playwright test credit-finish-bugfixes",frontend/app.js,standard,runs/T3/,retry loop in completeBlockWithCredit + note||task_name in renderTodayLog
  T4,e2e spec for BUG-2 + BUG-3,T3,done,M,test,tests/e2e/credit-finish-bugfixes.spec.js,"VAL-BUG2-001,VAL-BUG3-001","npx playwright test credit-finish-bugfixes",tests/e2e/credit-finish-bugfixes.spec.js,standard,runs/T4/,route-fail retry + note shown in today log
  T5,Full verify,"T2,T4",done,S,review,,"VAL-BUG1-001,VAL-BUG1-002,VAL-BUG2-001,VAL-BUG3-001","uv run pytest -q && npx playwright test credit-finish-bugfixes timer skip break-resume",,review,runs/T5/,all green
```
