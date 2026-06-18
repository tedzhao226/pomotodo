# FINDINGS — Skip block credit

## Repo facts

- Today, leaving a running work block (break tab @ app.js:1742, or ⏭ via
  `skipSession` @1604) runs `confirmDiscardPomodoro` → `finishBlock(false)` (no
  credit), then `switchMode`. The break tabs already let you pick short/long; the
  gap is only that it always discards.
- Natural end: `advanceAfterComplete` → `completeBlockWithCredit` (@1444) opens
  the credit modal, credits, streak++, then `switchMode(streakBasedBreak,
  {auto:true})`.
- `remainingSeconds` and `durationMin*60` share units (TIME_SCALE=1).
- Crediting is frontend via `POST /api/blocks/{id}/credit`; no backend change.

## Decisions (user)

- ≥1/3 elapsed → open the credit checklist (natural-end behavior), then chosen break.
- <1/3 → keep the discard confirm, then chosen break.
- Break type = the user's tab choice (⏭ = short).

## Execution Log

- 2026-06-18 15:14 — plan written. Frontend-only; tasks F1/T1/V1 pending.
- 2026-06-18 15:20 — F1+T1+V1 done. skip.spec.js 3/3; full e2e 12 passed (timer
  suite intact), pytest 48, vitest 12. Skip credits ≥1/3 via the credit modal,
  discards <1/3 (confirm), break = chosen tab; ⏭ → short break. No backend change.
