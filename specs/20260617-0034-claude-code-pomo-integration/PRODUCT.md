# Claude Code ↔ Pomotodo Integration

## Intent

Let a developer run the pomodoro loop without leaving the Claude Code terminal:
start a pomo, see it count down, get nudged to rest when it expires, and have
the pomo's "what did I do" note auto-filled from the actual Claude session
activity. Pomotodo's backend already owns the timer and syncs it across devices
(`running_block`, server break state); Claude Code becomes **one more thin
client** of that same backend — it never owns timer state.

This is exploratory/forward-looking. The MVP targets the **current global
single-tenant** backend (the app as it runs today on localhost), exactly as
break-sync (spec 20260616-1813) treats timer state as global. Per-user scoping
and a CLI auth token are **out of scope** until auth (spec 20260613-2207-auth-
multitenant) lands; the integration will adopt the same token model then.

## Behavior

- **Start** — `/pomo start [task text]` from inside Claude Code starts a server
  pomo block. With no running task it quick-creates a task and starts a block on
  it; with text it creates/uses that task. Output confirms the running pomo and
  its deadline.
- **Single active pomo** — starting a pomo while one is already running does
  **not** create a second. The web app and Claude Code converge on one
  `running_block` (the "dual" risk: never two active pomos for the same user).
- **Live countdown** — the Claude Code statusline shows the active pomo's
  remaining time (`🍅 12:34`), read from the server each render. Passive, no
  interrupt.
- **Rest reminder** — when the active pomo has expired, Claude surfaces a
  "time to rest" nudge at the next turn boundary (Stop / next prompt). This is
  best-effort at turn boundaries, not a real-time alarm (a conversation cannot
  interrupt mid-turn). A true OS alarm is out of scope for v1.
- **Capture** — `/pomo done` (or an expired pomo being closed) credits the
  active block with a `note` summarizing what happened this pomo, derived from
  the Claude session transcript (files edited, commands run, turn count) — not
  hand-typed.
- **Cross-session** — a pomo (25 min) may span many Claude turns or sessions, or
  none. All hooks bind work to the **server's active-pomo-id**, never to a Claude
  session id. Closing the terminal does not end the pomo; reopening resumes the
  same one.

## Scope

- **In (v1):** a `pomo` client helper (start/status/done) over the existing HTTP
  API; a statusline countdown; Claude Code hooks (Stop, UserPromptSubmit,
  SessionStart) for reminder + capture + resume; a transcript→note heuristic.
  All against localhost global single-tenant.
- **Out:** real-time OS alarm / mid-turn interrupt (turn-boundary nudges only).
- **Out:** per-user auth + CLI token (waits on auth-multitenant; v1 is global
  single-tenant, no token).
- **Out:** LLM-generated summaries for capture (v1 uses a cheap offline heuristic
  over the transcript; LLM summary can replace it later behind the same note).
- **Out:** live cross-device push (rides the same poll model as today).

## Acceptance

### VAL-CC-001: `/pomo start` starts a server pomo block
Given a clean backend with no running block.
When `pomo start "fix parser"` runs.
Then the backend has a `running_block` for that task and the command prints its
deadline.
Evidence: integration test driving `pomo` against a throwaway server (see TECH ## Tests).

### VAL-CC-002: Single active pomo — second start does not duplicate
Given a backend already has a `running_block`.
When `pomo start "other"` runs.
Then no second running block is created; the command reports the existing
running pomo (reuse, not duplicate).
Evidence: pytest backend single-active test + `pomo` integration test.

### VAL-CC-003: Statusline shows active pomo remaining time
Given a `running_block` with a future deadline.
When the statusline script runs.
Then it prints the pomo's remaining `MM:SS`; with no running block it prints
nothing (or idle marker).
Evidence: statusline script run against a throwaway server with a seeded block.

### VAL-CC-004: Expired pomo surfaces a rest reminder at a turn boundary
Given a `running_block` whose deadline is in the past.
When the Stop / UserPromptSubmit hook runs.
Then it emits a "time to rest" reminder referencing that pomo.
Evidence: hook script run against a throwaway server with an expired block.

### VAL-CC-005: `/pomo done` credits the active block with a derived note
Given a `running_block` and a transcript with edited files / commands.
When `pomo done` (or hook-driven close) runs.
Then the block is credited and its `note` contains the derived summary (edited
files / command count), not an empty/hand-typed string.
Evidence: `pomo` integration test asserting the credited block's `note`.

### VAL-CC-006: Hooks bind to server active-pomo-id, not session id
Given a `running_block` started in session A.
When a hook fires in a different session B (same backend).
Then it operates on the same active pomo (capture/reminder target that block),
proving binding is by server state, not Claude session id.
Evidence: hook/`pomo` invoked with two distinct session ids against one server,
both resolving the same block id.
