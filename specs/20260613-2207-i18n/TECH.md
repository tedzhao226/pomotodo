# Multi-language Support — Tech Spec

Product spec: specs/20260613-2207-i18n/PRODUCT.md

## Problem

Strings live inline in HTML and in JS template literals with no catalog, so there is no seam
to swap languages. A lightweight, build-free approach is required (the frontend has no bundler).

## Relevant Code

- `static/index.html:16-22` — brand, nav buttons (static strings).
- `static/index.html:60-` — panel headings, button labels, input placeholders, settings labels.
- `static/app.js:4-25` — `SETTINGS_KEY` / `loadSettings` / `saveSettings`; mirror this
  localStorage pattern for `lang`.
- `static/app.js:527` — planned-sum string (`Planned N blocks`).
- `static/app.js:535` — filter indicator string.
- Dynamic strings throughout `app.js`: timer mode labels, prompts, `Nothing here.`,
  `No finished pomos today.`, button text in the single timer button.

## Current State

Strings are inline in HTML and template literals; there is no catalog or `t()` indirection.

## Implementation

- Add `static/i18n.js` (loaded before `app.js`):
  - `const MESSAGES = { en: {...}, zh: {...} }`.
  - `let lang`, initialised from `localStorage["pomotodo.lang"]` → `navigator.language` → `"en"`.
  - `t(key, vars)` returns the string for the active language, interpolating `{var}`
    placeholders; falls back to English, then to the key.
  - `setLang(next)` writes localStorage, sets `document.documentElement.lang`, then triggers a
    re-render.
- HTML: tag static nodes with `data-i18n="key"` (and `data-i18n-ph="key"` for placeholders).
  `applyTranslations()` walks `[data-i18n]` / `[data-i18n-ph]` and sets text/placeholder.
- JS: replace inline literals with `t("...")`; interpolated counts use `t("planned", {n})`.
- Switcher: a `<select>` in the Settings view (`static/index.html:169`) wired to `setLang`;
  on change call `applyTranslations()` + `renderAll()`.

## Edge Cases

- Missing key → English fallback → raw key (never blank).
- Count interpolation (`Planned {n} blocks`) keeps pluralization simple per language; Chinese
  has no plural form, English keeps the existing `block/blocks`.
- Switching language mid-timer must not reset the countdown — only text is re-rendered, timer
  state is untouched.

## Tests

- No backend tests.
- `node --check static/i18n.js`.
- Manual: switch to 中文 → nav, timer labels, todos, settings translate; reload preserves the
  choice; a missing key falls back to English.
