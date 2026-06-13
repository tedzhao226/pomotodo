# Tag Block Stats — Product Spec

Links: none provided.

## Summary

When a tag filter is active, the plain "Showing #tag ✕" indicator becomes a distinct summary
banner showing how many pomodoro blocks that tag has.
It is styled differently from the Today "Planned N blocks" line so the two readings aren't
confused.

## Problem

Filtering by a tag gives no aggregate at all; the only block summary on Main is Today's planned
estimate, which is about today, not about the tag.

## Goals

- Surface a per-tag block count when a tag is selected.
- Make it visually distinct from the Today planned sum.

## Non-goals

- A new statistics page or per-tag time-series (the Statistics view already has Top Tags).
- Editing tag stats.

## User Experience

Selecting a tag shows a banner like `#learn · 24 done · 6 planned ✕` with its own accent
(tag/blue, banner/pill) that reads differently from the muted "Planned … blocks" Today header.
Clicking the banner (✕) still clears the filter.
