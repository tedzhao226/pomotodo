# Findings: Claude Code ↔ Pomotodo Integration

## Relevant Files

- `backend/api.py` - routes the client reuses: `POST /tasks`,
  `POST /tasks/{id}/blocks` (start_block), `GET /dashboard` (running_block +
  break_state), `POST /blocks/{id}/credit` (note = capture), `PATCH /blocks/{id}`.
- `backend/service.py` - `start_block`, `credit_block`, `get_dashboard`; the
  place a single-active-pomo guard would go if not already present.
- `backend/repository.py` - block persistence; check existing running-block /
  dedup logic before adding a guard.
- `specs/20260616-1813-break-server-sync/` - precedent: timer state is global
  single-tenant server-side; auth scoping deferred. Same model adopted here.
- `specs/20260613-2207-auth-multitenant/` - the auth work this integration's
  per-user token + scoping depends on; out of scope for v1.
- `CLAUDE.md` - throwaway-server test recipe reused for client integration tests.

## Discoveries

- The pomo "what did I do" data already exists as the block `note`, written at
  `credit_block(block_id, task_ids, note)`. Capture maps onto it — no new data
  model, no new column.
- A pomo block is **task-anchored**: starting a pomo requires a task id, so
  `/pomo start` must quick-create or pick a task before starting a block.
- `GET /dashboard` is the universal read path for "is a pomo running + deadline".
  Every client (web, break-sync second device, Claude Code) rides it. Reusing it
  means no new read endpoint and automatic cross-device consistency.
- Backend is global single-tenant today (`running_block` is a singleton, like
  break state). This is why v1 needs no auth token — Claude Code hits the same
  localhost backend as the web app.

## Knowledge Updates

- Claude Code integration points usable here: a slash/skill command (user-driven
  start/done/status), a `statusLine` command (passive countdown), and hooks
  (`SessionStart`, `UserPromptSubmit`, `Stop`) for resume / reminder / capture.
  Hooks receive JSON on stdin including `transcript_path` — the basis for the
  capture heuristic. None of these can interrupt mid-turn, so reminders are
  turn-boundary best-effort, not real-time alarms.

## Drift

- Open: whether `start_block` already enforces a single running block. Commit
  `pomo-dedup-soft-delete` implies dedup exists but on a different axis (history
  de-dup). T1 must confirm before deciding if VAL-CC-002 needs a backend guard or
  is satisfied client-side only.
- Open: exact local dev port / how the backend is normally launched outside tests
  (CLAUDE.md uses 8731 for the e2e throwaway server). `POMOTODO_API` default
  should match the real run command — confirm in T1.

## Durable Candidates

- "Backend = single source of truth; every surface (web, second device, Claude
  Code) is a thin client over `GET /dashboard`" — the architectural rule that
  makes cross-session/cross-device pomo work without per-client timer logic.

## Execution Log

(planning only — no tasks dispatched yet)
