# Diss post + shareable skills repo

## Intent

Ship two coupled deliverables off the pomotodo "vibe-coded a Pomodoro app" story:

1. A LinkedIn long-form **engage post** (drafted in Obsidian rough-notes), in the
   user's own casual/self-deprecating voice, that pitches the app and then pivots
   to the real takeaway — the toolchain (Claude Code + Cmux + Conductor) — with
   extended sections on cmux-driven e2e, conductor plan/exec/verify + subagent
   orchestration, the Codex second-opinion, and the multi-model token strategy.
2. A **new public GitHub repo** (`tedzhao226/<name>`, default `claude-skills`) that
   shares three items across three tiers — `cmux` (oss skill), `conductor`
   (personal skill), and the `codex` Claude Code **plugin** (`plugins/`, install via
   marketplace) — with install docs. The old share repo `dot_claude_example` is
   removed and replaced by this one.

Voice rule: the **post prose is the user's voice** (casual engage post), not the
assistant's terse/caveman mode. Repo docs are normal technical prose.

Install convention (user's ask):
- `oss/<skill>` — ship **source/target meta only** (a pointer: upstream source +
  install target path + command), not a redistributed copy.
- `personal/<skill>` — **full copy** of the skill in the repo.
Mapping here: `cmux` is third-party → oss pointer; `conductor` is the user's own →
personal full copy.

## Scope

- **In:** Obsidian rough-note draft (already seeded this session); new public repo
  scaffold (oss/personal, README install docs, `make list-skills`); `oss/cmux`
  pointer; `personal/conductor` full copy; push to GitHub public; remove old
  `dot_claude_example` (local + GitHub); finalize post with the real repo URL.
- **Out:** sharing any skill beyond cmux + conductor; auto-posting to LinkedIn
  (user posts manually); CI/license polish beyond a basic README + LICENSE.
- **Assumption:** repo name `claude-skills` unless user overrides at exec. cmux's
  upstream source string is resolved at exec (marketplace / cmux app); if unknown,
  the pointer records the install target + a TODO for the source URL.

## Acceptance

### VAL-DISS-001: Engage post draft exists with all required sections
Given the Obsidian vault `~/workspace/obsidian`.
When the rough-note draft is read.
Then it contains, in the user's casual voice: the "no JS / replaces decommissioned
paid app" hook; the what-it-does bullets (`#tag` filter, `# *` inline parse,
dopamine dashboard); the three-tool takeaway (Claude Code, Cmux, Conductor); and
the four extended sections — cmux e2e via `/cmux`, conductor plan/exec/verify +
subagents, Codex second-opinion, multi-model token strategy (claude/codex/
cursor/opencode) — plus a repo-link slot.
Evidence: `~/workspace/obsidian/1-rough-notes/2026-06-18-vibe-coding-pomo-engage-post.md`
exists with those sections.

### VAL-DISS-002: New public repo has the oss/personal split sharing only cmux + conductor
Given the new repo working tree.
When its `skills/` tree is listed.
Then `skills/oss/cmux/` holds a source/target pointer (no full skill copy),
`skills/personal/conductor/` holds the full conductor skill, and no other skills
are present; the README documents the oss=pull-from-source vs personal=copy-in
install convention and a `make list-skills` target works.
Evidence: `ls skills/oss skills/personal` shows only `cmux` and `conductor`
respectively; `make list-skills` runs; README contains both install paths.

### VAL-DISS-005: Codex plugin shared as a marketplace pointer (not a skill copy)
Given the new repo working tree.
When `plugins/codex/INSTALL.md` is read.
Then it records the plugin id `codex@openai-codex`, the marketplace
`openai/codex-plugin-cc`, and the `/plugin marketplace add` + `/plugin install`
commands (plus the `codex` CLI requirement) — and the README documents the
`plugins/` tier as install-via-marketplace. No codex skill folder is copied into
`skills/`.
Evidence: `test -f plugins/codex/INSTALL.md`; README has a "plugins" tier + install
subsection; `skills/` contains only cmux + conductor.

### VAL-DISS-003: New repo published public; old share repo retired locally
Given GitHub for `tedzhao226`.
When `gh repo view <new>` runs and `~/workspace/dot_claude_example` is checked.
Then the new repo exists and is public, and the old `dot_claude_example` is
retired from the active workspace (local clone archived to `~/workspace/.archive/`).
**Exec-time decision (2026-06-18):** the user chose to KEEP the GitHub repo
`tedzhao226/dot_claude_example` (not delete it) and archive the local clone only;
the GitHub-deletion sub-assertion is intentionally relaxed.
Evidence: `gh repo view <new>` succeeds; `~/workspace/dot_claude_example` absent;
`~/workspace/.archive/dot_claude_example` present; GitHub old repo retained by choice.

### VAL-DISS-004: Post links the real repo URL
Given the new repo is published (VAL-DISS-003) and the draft exists (VAL-DISS-001).
When the rough-note draft is read.
Then the `[REPO_URL]` placeholder is replaced with the live repo URL.
Evidence: grep for `[REPO_URL]` in the note returns nothing; the live URL is present.
