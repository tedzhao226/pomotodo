# Claude Code ↔ Pomotodo Integration — Approach

Backend is the single source of truth; the Claude Code side is a thin client over
the existing HTTP API. No new timer logic on the client. No new dependencies:
the client helper uses the Python stdlib (`urllib`) so it runs with no install.

## Backend contracts reused (grounded in `backend/api.py`)

- `POST /tasks` → create a task (for quick-create on start).
- `POST /tasks/{task_id}/blocks` body `{duration_min}` → `start_block`; starts a
  pomo block on a task. Returns `BlockStartResponse` (block id, deadline).
- `GET /dashboard` → `DashboardResponse` carrying `running_block` (the active
  pomo) and `break_state`. This is how every client reads "is a pomo running and
  when does it end".
- `POST /blocks/{block_id}/credit` body `{task_ids, note}` → `credit_block`; this
  is where the **capture note** is written.
- `PATCH /blocks/{block_id}` body `{completed}` → `end_block`.

API base URL via env `POMOTODO_API` (default the local dev server, e.g.
`http://localhost:8731` per CLAUDE.md). Global single-tenant: no auth header in
v1.

## Single-active-pomo invariant (VAL-CC-002)

Verify first whether `start_block` already rejects/dedupes a second running
block (commit `pomo-dedup-soft-delete` suggests dedup exists). Two outcomes:

- If the backend already enforces one running block, the client just reads
  `running_block` before starting and reports the existing one — no backend
  change.
- If it does not, add a guard in `service.start_block`: when a `running_block`
  exists, return it instead of creating a second (idempotent start). Smallest
  safe change; covered by a backend test.

The client always checks `GET /dashboard.running_block` first regardless, so the
"second start reuses" behavior holds even if the backend guard is added later.

## Client layout — `integrations/claude-code/`

```
integrations/claude-code/
├── pomo                # python3 stdlib CLI: start | status | done
├── statusline.sh       # prints "🍅 MM:SS" from GET /dashboard
├── hooks/
│   ├── on_stop.py          # Stop: expiry check → reminder; optional capture
│   └── on_prompt.py        # UserPromptSubmit: expiry → rest reminder
│   └── on_session_start.py # SessionStart: resume/announce active pomo
├── summary.py          # transcript → note heuristic (shared by pomo done + hooks)
├── settings.example.json   # Claude Code hooks + statusLine wiring to copy in
└── README.md           # install: copy settings, set POMOTODO_API
```

`pomo` and the hooks share `summary.py` and a tiny `api.py`-style client (kept
inline; no package). Everything reads `POMOTODO_API`.

## Capture heuristic — `summary.py` (VAL-CC-005)

Claude Code hooks receive JSON on stdin including `transcript_path` (a JSONL of
the session). The heuristic, offline and cheap:

- read the transcript JSONL since the active pomo started (filter by ts ≥ block
  start; fall back to whole transcript),
- collect: files touched (Edit/Write tool inputs), commands run (Bash inputs,
  truncated), turn count,
- render a compact note like:
  `CC: edited app.js, repository.py; 6 cmds; 9 turns`.

No LLM call in v1. The `note` field accepts any string, so an LLM summary can
swap in later behind the same contract.

## Reminder mechanism (VAL-CC-004)

Turn-boundary only — a conversation cannot self-interrupt mid-turn.

- `on_prompt.py` (UserPromptSubmit) and `on_stop.py` (Stop) call `GET /dashboard`,
  compute `now ≥ running_block.deadline`, and if expired print a reminder to
  stdout (surfaced to the model/user as hook context).
- Statusline gives the always-visible passive countdown so the nudge is not the
  only signal.
- A real OS alarm would need a separate background daemon (the pomotodo desktop
  app may already cover this) — explicitly out of scope.

## Cross-session binding (VAL-CC-006)

No hook keys off the Claude session id. Every hook resolves the target pomo from
`GET /dashboard.running_block.id`. SessionStart announces/resumes whatever pomo
the server says is running; SessionEnd does nothing to the pomo. This makes the
pomo lifecycle independent of session lifecycle by construction.

## Hooks wiring — `settings.example.json`

```jsonc
{
  "statusLine": { "type": "command", "command": "integrations/claude-code/statusline.sh" },
  "hooks": {
    "SessionStart":     [{ "hooks": [{ "type": "command", "command": "python3 integrations/claude-code/hooks/on_session_start.py" }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "python3 integrations/claude-code/hooks/on_prompt.py" }] }],
    "Stop":             [{ "hooks": [{ "type": "command", "command": "python3 integrations/claude-code/hooks/on_stop.py" }] }]
  }
}
```

`/pomo` itself is a Claude Code skill/slash thin wrapper that shells the `pomo`
CLI (start/status/done). Document both the slash command and direct CLI use.

## Tests

- **Backend unit** (`tests/test_*.py`): single-active-pomo invariant on
  `start_block` (VAL-CC-002) — only if a backend guard is added.
- **Client integration**: a pytest that boots a throwaway server the way CLAUDE.md
  describes (`POMOTODO_DATABASE_URL=sqlite:////tmp/pomo_cc_test.db`, alembic
  upgrade, uvicorn on a test port), then drives the `pomo` CLI and the hook/
  statusline scripts as subprocesses, asserting against `GET /dashboard` and the
  credited block `note`. Covers VAL-CC-001/002/003/004/005/006.
- **summary.py unit**: feed a synthetic transcript JSONL, assert the derived note
  lists edited files and command count (VAL-CC-005).

### Verification commands

```sh
# backend invariant (if guard added)
uv run pytest -q tests/test_single_active_block.py

# client + hooks + statusline against a throwaway server
uv run pytest -q tests/test_claude_code_integration.py

# summary heuristic
uv run pytest -q tests/test_cc_summary.py
```
