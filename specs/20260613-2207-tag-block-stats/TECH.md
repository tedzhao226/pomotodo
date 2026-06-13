# Tag Block Stats — Tech Spec

Product spec: specs/20260613-2207-tag-block-stats/PRODUCT.md

## Problem

A tag filter shows no aggregate, even though the dashboard already carries completed block
counts per tag. The data exists; it just isn't surfaced on Main, and the indicator needs a
distinct visual from the Today planned sum.

## Relevant Code

- `app/repository.py:192-206` — `get_tag_summaries` returns `{tag, blocks, total_minutes}`
  (completed-only), served via `DashboardResponse.tags`.
- `static/app.js` — `renderTaskList` (planned sum + filter indicator), `els.filterIndicator`,
  the indicator click handler that clears the filter (`state.selectedTag = null`).
- `static/index.html` — `#filter-indicator`, `#planned-sum`.
- `static/style.css` — `.filter-indicator`, `.planned-sum`.

## Current State

`filterIndicator` shows only `Showing #tag ✕`.
`state.dashboard.tags` carries per-tag completed block counts but is unused on the Main view.
The planned sum is the sum of Today estimates.

## Implementation

- In `renderTaskList`, when `state.selectedTag` is set:
  - look up the tag in `state.dashboard.tags` → `blocks` (completed/"done"),
  - compute planned = sum of `estimate_blocks` over all tasks carrying the tag (Today + Backlog),
  - render the filter banner as `#tag · {done} done · {planned} planned ✕`.
- Restyle `.filter-indicator` into a distinct tag-summary banner (tag/blue accent, its own shape)
  so it does not read like the muted `.planned-sum`.
- No backend change — `dashboard.tags` already provides completed counts.

## Edge Cases

- Tag with zero completed blocks → `0 done`.
- Tag present on done tasks still counts in planned (planned spans all tasks with the tag).
- The banner must still clear the filter on click.
- Planned count spans both Today and Backlog tasks with the tag (decision: count all).

## Tests

- `node --check static/app.js`.
- Manual: filter a tag → banner shows correct done/planned and is visually distinct from the
  Today line; clearing (✕) works.
- `get_tag_summaries` completed-only counting is already exercised indirectly by the suite.
