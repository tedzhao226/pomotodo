# Tasks: Diss post + shareable skills repo

**Goal**: Publish a new public repo sharing only cmux (oss) + conductor (personal), retire the old `dot_claude_example` repo, and finalize the LinkedIn engage post (drafted in Obsidian) with the live repo URL.
**Spec Folder**: /Users/ted/workspace/pomotodo/specs/20260618-1714-diss-post-and-skills-repo
**Acceptance**: /Users/ted/workspace/pomotodo/specs/20260618-1714-diss-post-and-skills-repo/PRODUCT.md (## Acceptance, VAL-DISS-*)

## Tasks

Execution: serial

```text
tasks[5]{id,title,depends_on,status,size,type,file,contract_refs,acceptance,write_set,backend,run_path,result}:
  T1,Scaffold new skills repo (oss/personal + cmux pointer + conductor copy),,done,M,impl,~/workspace/claude-skills,VAL-DISS-002,"ls ~/workspace/claude-skills/skills/oss ~/workspace/claude-skills/skills/personal && make -C ~/workspace/claude-skills list-skills",~/workspace/claude-skills,claude,runs/T1/,oss=cmux pointer only / personal=conductor full copy; make list-skills passes
  T2,Create public GitHub repo and push,,done,S,impl,~/workspace/claude-skills,VAL-DISS-003,gh repo view tedzhao226/claude-skills,~/workspace/claude-skills,claude,runs/T2/,live: https://github.com/tedzhao226/claude-skills (public, master pushed)
  T3,Retire old dot_claude_example (archive local; GitHub kept per user),,done,M,impl,~/workspace/dot_claude_example,VAL-DISS-003,"test ! -e ~/workspace/dot_claude_example && test -e ~/workspace/.archive/dot_claude_example",,claude,runs/T3/,local clone archived to ~/workspace/.archive/; user chose to KEEP GitHub repo (no delete)
  T4,Finalize Obsidian post: insert live repo URL + tone pass + codex plugin mention,,done,S,impl,~/workspace/obsidian/1-rough-notes/2026-06-18-vibe-coding-pomo-engage-post.md,"VAL-DISS-001,VAL-DISS-004","grep -c '\[REPO_URL\]' ~/workspace/obsidian/1-rough-notes/2026-06-18-vibe-coding-pomo-engage-post.md",~/workspace/obsidian/1-rough-notes/2026-06-18-vibe-coding-pomo-engage-post.md,claude,runs/T4/,redrafted in user voice + codex-plugin line; live URL in; 0 placeholders
  T5,Publish matured article to Quartz blog,,done,M,impl,~/workspace/blog/content/posts/202606181714-vibe-coding-pomodoro-full-ai-slop-stack.md,VAL-DISS-001,"cd ~/workspace/blog && npx quartz build","~/workspace/blog/content/posts,~/workspace/blog/content/attachments",claude,runs/T5/,"quartz build OK (0 errors, 36 files); 7 embeds -> <img>, 0 unresolved; pushed main f8d9568; Pages deploy in_progress"
```

`status` values: `pending | in_progress | done | failed | blocked`.
Serial: exec runs T1→T2→T3→T4 top-to-bottom. T2 needs T1's tree; T4 needs T2's live URL; T3 (removal) is run after the replacement is live so the old repo is never the only copy.

### T1: Scaffold new skills repo

Create `~/workspace/claude-skills/` (confirm/override the name with the user first; default `claude-skills`). `git init`. Layout:
- `skills/oss/cmux/SOURCE.md` — pointer only, NO full skill copy. Record: skill name `cmux`; upstream source (resolve the real source — cmux marketplace / the cmux app's bundled skills; if unknown, write the install target and a `TODO: source URL`); install target `~/.claude/skills/cmux`; one-line install/copy command.
- `skills/personal/conductor/` — full recursive copy of `~/.claude/skills/conductor/**` (include `references/`).
- `README.md` — explain the repo + the install convention: oss skills are pulled from their upstream source (use the pointer), personal skills are copied straight in (`cp -r skills/personal/<name> ~/.claude/skills/`). Mirror the structure section style of the old dot_claude_example README but only for these two skills.
- `Makefile` — a `list-skills` target (reuse dot_claude_example's `make list-skills` recipe) that lists every skill under `skills/*/*/` with its description.
- `LICENSE` — MIT, author Ted Zhao.
Do NOT touch `~/workspace/agent-system`.
Contract refs: VAL-DISS-002

### T2: Create public GitHub repo and push

`gh repo create tedzhao226/claude-skills --public` (match the name chosen in T1), set as `origin`, commit the scaffold, push `master`. Capture the live URL into `result` (T4 needs it).
Contract refs: VAL-DISS-003

### T3: Remove old dot_claude_example

IRREVERSIBLE — confirm with the user before each destructive step.
- GitHub: `gh repo delete tedzhao226/dot_claude_example --yes` (needs `delete_repo` scope; if missing, surface `gh auth refresh -h github.com -s delete_repo`).
- Local: move `~/workspace/dot_claude_example` to `~/workspace/.archive/` (preferred) or remove it per the user's choice.
Verify `gh repo view tedzhao226/dot_claude_example` now fails (not found).
Contract refs: VAL-DISS-003

### T4: Finalize Obsidian post

In `~/workspace/obsidian/1-rough-notes/2026-06-18-vibe-coding-pomo-engage-post.md`, replace both `[REPO_URL]` placeholders with the live URL from T2, and clear the `[REPO_URL]` note line in the front block. Do a light tone pass (keep the user's casual voice; do not rewrite in assistant voice). Confirm `grep -c '\[REPO_URL\]'` returns 0.
Contract refs: VAL-DISS-001, VAL-DISS-004
