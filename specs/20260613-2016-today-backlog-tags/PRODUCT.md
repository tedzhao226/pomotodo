# Today / Backlog + Click-to-Filter Tags — Product Spec

Links: none provided.

## Summary

The Main view's Todos panel splits into two headed sub-lists, **Today** and
**Backlog**.
Today's header shows the total planned blocks (the sum of estimates).
The standalone "Filter by tag" panel is removed; filtering happens by clicking a
tag on any row.

## Problem

The dedicated tag-filter panel duplicates the clickable `#tag` chips already on
every row.
There is no view of the daily planned load, even though planning is today-only by
default.
There is nowhere to park work that won't get finished today, so the single list
mixes intent with backlog.

## Goals

- Remove the "Filter by tag" panel in favor of clicking a row's tag.
- Show the total planned blocks for Today (sum of estimates).
- Split todos into Today and Backlog buckets with a manual per-row move.

## Non-goals

- Auto-rollover of unfinished todos at the day boundary.
- Due dates or multi-day planning.
- Server-side persistence of reorder, or per-bucket order beyond the existing
  local order.

## User Experience

### Tag filtering

The "Filter by tag" panel is removed.
Clicking a row's `#tag` filters both sub-lists to that tag.
A small "Showing #tag ✕" indicator appears above the lists and clears the filter
when clicked; clicking the already-active tag again also clears it.

### Today / Backlog buckets

The Todos panel shows two headed sub-lists: **Today** and **Backlog**.
New todos land in Today.
Each Today row has a `→ Backlog` control; each Backlog row has a `→ Today` control.
An empty bucket shows a short empty-state line.

### Planned sum

The Today header shows `Planned: N blocks`, where N is the sum of `estimate_blocks`
over all Today-bucket tasks.
Done tasks are included; a task with no estimate counts 0.
The sum reflects all Today tasks and is unaffected by the active tag filter.

### Reorder

Drag-to-reorder stays within the Today list only.
Backlog rows are not draggable.
