# Multi-language Support — Product Spec

Links: none provided.

## Summary

All UI strings become translatable, with English as the default and 简体中文 as the second
language.
A switcher lets the user pick a language; the choice persists and applies live.

## Problem

Every string is hard-coded English in `index.html` and `app.js`, so the app cannot be used
in another language.

## Goals

- A central string catalog with a `t(key)` lookup.
- A language switcher (Settings, optionally also the topbar).
- Persist the choice in localStorage; update `<html lang>`.
- Adding a new language is just adding a catalog entry.

## Non-goals

- Server-side locale negotiation, RTL layouts, or a pluralization library.
- Translating user data (task names, notes).
- ICU date/number formatting beyond the `toLocaleString` already used.

## User Experience

A language `<select>` sits in the Settings view (and optionally near the topbar user menu).
Switching re-renders all visible text immediately without reloading or resetting timer state.
The initial language comes from a saved choice, else `navigator.language`, else English.
