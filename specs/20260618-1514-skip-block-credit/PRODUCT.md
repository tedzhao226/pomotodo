# Skip a work block into a break, crediting it past 1/3

## Intent

Today, leaving a running work block early — clicking the **Short Break** /
**Long Break** tab or the **⏭** skip button — always runs `confirmDiscardPomodoro`
and drops the block with **no credit**, then goes to a break. You lose the work
even if you were nearly done.

Change it so skipping a work block can **credit it as a pomo** when enough time
has passed, and lets you pick the break:

- Skip while a work block has run **≥ 1/3 of its duration** → it counts as a pomo,
  exiting **just like a natural finish**: the credit checklist opens, you pick the
  task(s), it's credited (streak bumps), then it goes to the break you chose.
- Skip **< 1/3** → unchanged: confirm "discard, won't count", then the break.
- The break is whichever you chose — **Short Break** or **Long Break** tab — not
  the streak-auto choice. The **⏭** button skips to a short break under the same
  1/3 rule.

Frontend-only: crediting uses the existing `POST /api/blocks/{id}/credit`.

## Behavior

- **Trigger**: a running pomodoro (work) block, when the user clicks the Short/Long
  Break tab or ⏭. (Pomodoro↔break and break↔break switches are unchanged.)
- **Threshold**: `elapsed ≥ 1/3` where `elapsed = 1 − remainingSeconds /
  (activeBlock.durationMin × 60)`.
- **≥ 1/3**: open the credit checklist (same modal as a natural end), credit the
  checked task(s), bump the streak, then `switchMode(chosenBreak, {auto:false})`.
- **< 1/3**: `confirmDiscardPomodoro` (existing confirm); on confirm, discard (no
  credit), then `switchMode(chosenBreak, {auto:false})`.
- **Break type** = the user's explicit choice (tab) or short (⏭). The natural-end
  streak-based auto-pick is untouched for actual completions.
- Esc / abort path and natural completion are unchanged.

## Out of scope

- Backend / credit-endpoint changes.
- Changing the natural-completion break-type logic (streak-based) or auto-start.
- A new "long break via ⏭" — ⏭ stays short break; long break is the tab.
- Changing the 1/3 threshold into a setting.

## Acceptance

### VAL-SKIP-001: Skip ≥1/3 credits the block like a natural end
Given a running work block past 1/3 of its duration with a touched task.
When the user clicks a break tab (or ⏭).
Then the credit checklist opens; confirming credits the task (`blocks_done` +1),
bumps the streak, and transitions to the break.
Evidence: e2e skip spec — "skip ≥1/3 credits + streak++".

### VAL-SKIP-002: Skip <1/3 discards (with confirm), no credit
Given a running work block under 1/3 elapsed.
When the user skips.
Then the discard confirm appears; on confirm the block is not credited
(`blocks_done` unchanged), streak unchanged, and it transitions to the break.
Evidence: e2e skip spec — "skip <1/3 discards".

### VAL-SKIP-003: Chosen break type wins
Given a skip (either branch).
When the user picked Short vs Long Break.
Then `timerMode` becomes exactly that break — independent of streak cadence.
Evidence: e2e skip spec — "long-break tab → longBreak".

### VAL-SKIP-004: ⏭ button honors the rule
Given the ⏭ skip button on a running work block.
When clicked.
Then it applies the same 1/3 credit/discard rule and goes to a short break.
Evidence: e2e skip spec — "⏭ ≥1/3 credits to short break".

### VAL-SKIP-005: No regression
Given the suites.
When they run.
Then natural completion + Esc-abort behave as before; `npm run e2e`, `pytest`,
`vitest` pass.
Evidence: full suites green.
