# Approach

A research/design pipeline that ends in a decision doc, not shipped code. No app code is
edited in this spec. Each step writes its artifact into the spec folder so the follow-up
implementation spec can cite it.

## Method

1. **Capture + inventory** — run the app (`npm run e2e` infra already boots uvicorn on
   8788 against a throwaway DB; or `uvicorn` per repo README) and screenshot the three
   views (main / stats / history) at a normal desktop width. Inventory the current
   `:root` tokens in `frontend/style.css` (palette, type scale, spacing, shadow) and the
   fonts loaded in `index.html`. Write the diagnosis into `FINDINGS.md` — specific issues
   bound to tokens/rules.

2. **Apply `frontend-design` guidance** — invoke the `frontend-design:frontend-design`
   skill against the diagnosis + screenshots. Produce a draft direction: mood/reference,
   type system (family, scale, weights), color refinement, spacing rhythm, component
   density. Capture the draft in `FINDINGS.md`.

3. **External perspectives** — get two independent reads on the *current screenshots + the
   draft direction*:
   - **codex** — via the `codex-review` / `codex:codex-rescue` agent path (shells to the
     codex CLI).
   - **cursor** — via `cursor-agent` CLI.
   Ask each: what reads as off, what direction they'd take, what to change first. Save raw
   replies under `runs/` and distill into `FINDINGS.md`.

4. **Synthesize** — reconcile skill guidance + both external reads into one recommended
   direction in `DIRECTION.md`, recording where the externals agreed or moved the call,
   then reduce it to a prioritized, token-level **change list** against `style.css` +
   `index.html`.

## Tools / files

- Read-only on `frontend/style.css`, `frontend/index.html`, `frontend/i18n.js`.
- Writes confined to this spec folder: `FINDINGS.md`, `DIRECTION.md`, `runs/`.
- Skill: `frontend-design:frontend-design`. External CLIs: codex, cursor-agent.

## Tests

None — exploration spec. "Verification" is artifact existence + a fresh-eyes read that
the change list is concrete and small (handled by `/conductor verify`). No automated
command; do **not** invent one.

## Verification commands

```sh
ls specs/20260622-1121-frontend-refresh/DIRECTION.md   # deliverable exists
ls specs/20260622-1121-frontend-refresh/runs           # screenshots + external replies
```
