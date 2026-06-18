# TECH: Diss post + shareable skills repo

## Approach

Mostly host-context content + filesystem + `gh` work → `backend: claude` throughout
(needs the local Obsidian vault, the local skill source paths, and `gh`/confirm for
irreversible GitHub ops). No application code changes; pomotodo source is untouched.

### Sources (resolved this session)

- Skill sources: `~/.claude/skills/cmux/` and `~/.claude/skills/conductor/`.
- Old share repo to remove: `~/workspace/dot_claude_example` (remote
  `github.com/tedzhao226/dot_claude_example`, public; an older curated example
  snapshot referencing the now-superseded planner/swarm skills).
- Live full monorepo `~/workspace/agent-system` (oss/personal, managed by
  skill-manager) is **left untouched** — not the repo being removed.
- Obsidian draft target: `~/workspace/obsidian/1-rough-notes/`.

### Repo layout (new)

```
<repo>/
├── README.md              # what it is + install convention (oss vs personal)
├── Makefile               # list-skills target (mirrors dot_claude_example)
├── LICENSE                # MIT
└── skills/
    ├── oss/
    │   └── cmux/
    │       └── SOURCE.md   # pointer: name, upstream source, install target, cmd
    └── personal/
        └── conductor/      # full copy of ~/.claude/skills/conductor/**
```

`oss/cmux/SOURCE.md` records: skill name, upstream source (marketplace / cmux app —
resolve at exec; record install target + TODO if the source URL is unknown), the
install target `~/.claude/skills/cmux`, and the one-line install command. README's
oss instructions tell the reader to pull cmux from its source, not from this repo.

### Removal safety

Deleting the GitHub repo + local clone of `dot_claude_example` is **irreversible**.
Exec must confirm with the user before `gh repo delete` and before removing the
local clone (archive to `~/workspace/.archive/` rather than `rm -rf` if the user
prefers). `gh repo delete` needs the `delete_repo` scope.

## Tests

Inspection-based (no code to unit-test):

- `test -f ~/workspace/obsidian/1-rough-notes/2026-06-18-vibe-coding-pomo-engage-post.md`
  and grep it for the required section markers (cmux, conductor, codex, token).
- `ls <repo>/skills/oss` → only `cmux`; `ls <repo>/skills/personal` → only `conductor`.
- `test -f <repo>/skills/oss/cmux/SOURCE.md` and `test -f <repo>/skills/personal/conductor/SKILL.md`.
- `make -C <repo> list-skills` exits 0 and lists both.
- `gh repo view <new>` succeeds; `gh repo view tedzhao226/dot_claude_example` fails.
- Final: `grep -c '\[REPO_URL\]' <note>` → 0.

## Verification commands

```sh
NOTE=~/workspace/obsidian/1-rough-notes/2026-06-18-vibe-coding-pomo-engage-post.md
REPO=~/workspace/claude-skills   # adjust to chosen name
test -f "$NOTE" && grep -Eqi 'cmux' "$NOTE" && grep -Eqi 'conductor' "$NOTE" && grep -Eqi 'codex' "$NOTE"
ls "$REPO"/skills/oss "$REPO"/skills/personal
make -C "$REPO" list-skills
gh repo view "$(git -C "$REPO" remote get-url origin)" >/dev/null
gh repo view tedzhao226/dot_claude_example && echo "OLD REPO STILL EXISTS — fail" || echo "old repo gone — ok"
grep -c '\[REPO_URL\]' "$NOTE"   # expect 0 after T4
```
