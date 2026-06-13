# Pomotodo — Product Spec

Pomodoro timer fused with a tag-based todo tracker. Single-user, local-first web app.

## Goal

Let one person plan todos, run focused pomodoro blocks against them, and see their
productivity history — in a UI aligned 1-to-1 with the classic Pomotodo aesthetic.

## Views

Single page, three tabs in the header (only one visible at a time):

- **Main** — the daily workspace.
- **Statistics** — productivity history dashboard.
- **Settings** — all configurable values.

### Main view

- **Active-task banner** — pale-yellow pill showing the currently selected task + ✓.
- **Timer** — big countdown, current-task label, duration select (30/45/60/90), and
  `Start Pomo` / `Pause` / `Stop`. After a block ends: continue-or-rest prompt; rest runs
  a short/long break. Sound chime on block end and rest end.
- **Today** — `Finished N pomos` plus a log of today's completed blocks grouped per task,
  shown as `end–start  #tags name  × count`.
- **Todos** — add-todo input (`#tag` tags, `*N` estimate) at the top of the panel; tag
  filter chips; single-row todos with: circle status toggle, name, clickable `#tags`
  (filter), `done / estimate` badge, edit (✎), delete (🗑). `Clear completed` button.
  Rows are draggable to reorder. Clicking a row activates it for the timer; ✎ opens an
  inline editor (name / done / estimate + recorded start/end times).
- **Mini cards** (click → Statistics): Statistics (weekly bar + count), Goal (daily-goal
  donut `done/goal`), Pomo History (all-time + 30-day sparkline), Todo History (all-time).

### Statistics view

Range selector (7/30/90 days). KPIs: Total Pomodoros, Daily Average, Monthly Change
(green when positive). Charts: pomodoros-over-time line, Top Tags pie + legend, Best
Worktime pie (Morning/Afternoon/Evening/Night) + legend.

### Settings view

Daily goal, default duration, short-rest, long-rest, long-rest interval. Persisted in the
browser (localStorage); feeds the timer's rest logic, default duration, and Goal card.

## Task / block rules

- Raw add syntax: free text, `#tag` (repeatable), `*N` estimate. Name required.
- A task has status `active` | `done`; deletion cascades its tags + blocks.
- `done / estimate`: estimate is editable; done defaults to the count of completed blocks
  but can be manually overridden in the editor.
- Block durations limited to 30/45/60/90 min. Timer can pause/resume; a block left running
  is resumed on reload (or auto-finished if it overran while away).

## Out of scope (current version)

Auth / multi-user, server-side persistence of settings or task order, pin/reorder on the
server, due dates, recurring tasks. See `HANDOFF.md` for the backlog.
