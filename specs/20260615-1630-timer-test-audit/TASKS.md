# Tasks

Mode: exec

| id | task | owner | status | contract_refs |
| --- | --- | --- | --- | --- |
| T1 | Codex read-only audit of test suite vs design | codex | done | VAL-1..13 |
| T2 | Extend e2e_timer.js: pause/resume, auto-start, long break, + audit gaps | claude | done | VAL-7,10,11 |
| T3 | Backend test_bucket.py: credit edge cases (dedupe, unknown block) if missing | claude | done | VAL-12 |
| T4 | Remove/refresh stale browser-harness tests flagged by audit | claude | done | — |
| T5 | Verify: pytest + vitest + e2e_timer.js (failedCount 0) | claude | done | all |

Evidence: `runs/audit/` (codex report), e2e report JSON in `## Execution Log`.
