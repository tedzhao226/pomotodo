# Rest Trigger & Consecutive-Block Streak — Product Spec

Links: none provided.

## Summary

Rest is offered only when a work block completes naturally; discarding a block (long-press/Esc) skips
rest and breaks the streak; a long rest happens only after `longEvery` consecutive completed blocks,
with a small indicator showing progress toward it.

## Problem

Discarding a block currently still offers/auto-starts rest, and the long-rest cadence isn't tied to an
unbroken run of completed blocks — a discard in the middle still counts toward the long rest.

## Goals

- Rest is offered only after a natural completion.
- A long rest occurs only after N consecutive completed blocks (N = `longEvery`).
- A discard resets the streak to 0.
- Progress toward the long rest is visible.

## Non-goals

- Persisting the streak across reloads.
- Changing short/long rest durations or how a completed block counts toward a task.

## User Experience

### Natural completion
When the timer reaches 0, rest is offered — it auto-starts if **Auto-start rest** is on, otherwise the
Continue / Take-a-rest prompt is shown. The streak increments.

### Discard
Holding the button (or Escape) on a running work block ends it with **no rest** and **no prompt** —
straight to **Ready**. The block stays uncounted (unchanged) and the **streak resets to 0**.

### Long-rest cadence
After every `longEvery` consecutive completed blocks, the rest is a **long rest**; otherwise a short
rest. A discard mid-run means starting over toward the next long rest.

### Streak indicator
A small row of dots near the timer shows progress in the current cycle — filled for completed this
cycle, empty for remaining (e.g. `●●○` with one to go). Hidden when `longEvery ≤ 1`.
