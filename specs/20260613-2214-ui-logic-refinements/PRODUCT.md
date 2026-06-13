# UI / Logic Refinements — Product Spec

Links: none provided.

## Summary

A batch of Main-view UI and timer-logic refinements: one combined timer button, a settings-driven
block duration, an inline add-todo box inside the Today list, per-task Markdown notes, aligned todo
columns, and a rule that only naturally-completed pomodoros count toward a task.
These shipped during the build-out and are captured here as the contract.

## Problem

The earlier UI had three timer buttons, a redundant duration picker, a detached add-todo form,
no place for per-task context, misaligned tag/badge columns, and counted force-stopped pomodoros
as completed work.

## Goals

- One timer button covering start, pause/resume, and stop.
- Block duration comes from the Settings default, not a per-start picker.
- Add-todo input lives inside the Today list as an emphasized inline box.
- Each task can hold a Markdown note.
- Tag / block-count / action columns line up across rows.
- Only naturally-finished pomodoros count toward a task's done blocks.

## Non-goals

- Auth, Supabase, Vercel, i18n, tag-block-stats (each has its own spec).
- Rich-text notes beyond a simple Markdown subset.

## User Experience

### Single timer button
Idle shows a primary **▶ Start** (disabled until a task is selected). While running it is
**⏸ Pause**; while paused, **▶ Resume**. Holding the button (~550ms) or pressing **Escape** ends
the pomodoro; a "Hold to stop" hint shows while a block is active.

### Settings-driven duration
There is no duration dropdown. Starting a pomodoro uses the Settings "Default duration" value.

### Inline add-todo box
The add-todo field sits at the top of the Today list as a bordered box with a `+` prefix and a
focus ring; Enter adds the todo (no separate Add button).

### Per-task notes
The row editor (✎) has a Markdown note field. Rows with a note show a 🗒 toggle that expands a
rendered-Markdown panel under the row (headings, bold/italic, inline code, lists, safe links).

### Aligned columns
Across todo rows, the tag, the `(done/estimate)` badge, and the hover actions line up in fixed
columns regardless of name length or whether a row has a note.

### Completed-only counting
A pomodoro that runs to completion adds one done block to its task; a force-stopped pomodoro does
not count toward the task or its tag totals (it stays in history as incomplete).
