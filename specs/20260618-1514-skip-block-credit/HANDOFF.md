# HANDOFF — Skip block into break with 1/3 credit

## Outcome: DONE

Skipping a running work block (Short/Long Break tab or ⏭) now credits it like a
natural end when ≥1/3 of its duration has elapsed; under 1/3 it discards (with the
existing confirm). The break is the user's choice (⏭ = short). Frontend-only.

## Changes (frontend/app.js)
- `completeBlockWithCredit({ nextBreak })` — optional forced break (else streak-auto).
- `skipWorkBlockToBreak(breakMode)` — 1/3 rule: ≥1/3 → credit modal → chosen break; <1/3 → confirm discard → chosen break.
- Wired the break-tab handler + `skipSession` (⏭).

## Acceptance
VAL-SKIP-001..004 → tests/e2e/skip.spec.js (3 passed). VAL-SKIP-005 → e2e 12,
pytest 48, vitest 12 (natural completion + Esc-abort unchanged: timer suite green).
