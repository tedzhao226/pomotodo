# History Persistence & History Page — Product Spec

Links: none provided.

## Summary

Deleting (or clearing) a todo removes it from the todo list but keeps its pomo and todo history; a
new History tab shows an all-time timeline of completed pomos and a list of every todo ever created.

## Problem

Delete and "Clear completed" cascade-delete a task's blocks, so the pomo/todo history shrinks
(`all_time_pomos`, stats, tag totals all drop). There is also no place to browse full history — only
mini-card totals and a 90-day Statistics view.

## Goals

- Deletes are non-destructive to history.
- All-time pomo + todo history is browsable on its own page.
- The Main "Pomo History" / "Todo History" cards open it.

## Non-goals

- Restoring/un-deleting archived todos (no undo UI).
- Pagination/infinite scroll, editing history, or export.

## User Experience

### Delete / Clear completed
The todo leaves the Today/Backlog list immediately, but its pomos still count toward every stat and
the History page.
Confirm copy changes from "removes its pomo history too" to "removes it from your todos (history is
kept)".

### History tab
A new tab in the header nav with two sections:

- **Pomos** — completed pomodoros grouped by day, newest first; each row shows end–start time, task
  name, `#tags`, and duration; with a per-day count and an all-time total.
- **Todos** — every todo ever created (active, done, deleted), each showing its name, tags, a status
  chip (Active / Done / Deleted), blocks-done, and created date.

The Main mini-cards **Pomo History** and **Todo History** open this tab (today they open Statistics).
