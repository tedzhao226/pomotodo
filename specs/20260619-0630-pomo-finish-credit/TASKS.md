# Tasks

Execution: serial

```toon
id,title,depends_on,status,size,type,file,contract_refs,acceptance,write_set,backend,run_path,result
T1,Modal scenarios + creditable filter,,done,M,impl,frontend/app.js,"VAL-CR-001,VAL-CR-002,VAL-CR-003",screenshot both modals,frontend/app.js,claude,runs/T1/,completeBlockWithCredit + openCreditModal updated
T2,i18n alsoToday key,T1,done,S,impl,frontend/i18n.js,VAL-CR-002,grep key,frontend/i18n.js,claude,runs/T2/,credit.alsoToday en+zh
T3,Divider + label-only styles,T1,done,S,impl,frontend/style.css,VAL-CR-002,screenshot,frontend/style.css,claude,runs/T3/,credit-divider + label-only css
T4,Correct + extend design doc,,done,S,impl,docs/timer-states.md,VAL-DOC-001,read doc,docs/timer-states.md,claude,runs/T4/,single-block model + scenarios + checklist
T5,Verify (pytest + screenshots),"T1,T2,T3",done,S,review,,"VAL-CR-003,VAL-CR-004",pytest + shots,,claude,runs/T5/,pytest green + modal screenshots
```
