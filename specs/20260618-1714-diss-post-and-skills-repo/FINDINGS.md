# Findings: Diss post + shareable skills repo

## Relevant Files

- `~/.claude/skills/cmux/SKILL.md` - cmux core control skill (oss skill to share via pointer).
- `~/.claude/skills/cmux-browser/SKILL.md` - browser automation skill (the "/cmux e2e" story; not shared, referenced in post).
- `~/.claude/skills/conductor/` - the user's own orchestration skill (personal skill to full-copy).
- `~/workspace/dot_claude_example/` - old public share repo (`tedzhao226/dot_claude_example`) to remove.
- `~/workspace/agent-system/` - live full monorepo (oss/personal, skill-manager) — LEAVE UNTOUCHED.
- `~/workspace/obsidian/1-rough-notes/` - Obsidian rough-note target; draft seeded this session.
- `~/workspace/pomotodo/specs/` - ~24 conductor spec folders = evidence for the post's "built the whole app via conductor" claim.

## Discoveries

- `agent-system` already uses the desired `skills/oss` + `skills/personal` split; cmux lives in
  its `oss/`, conductor in its `personal/`. The new repo is a curated 2-skill public subset, NOT
  a clone of agent-system, and NOT the repo being removed.
- `dot_claude_example` is the old curated example-share repo (README + `make list-skills`,
  copy-the-config instructions). It still documents the superseded `planner`/`swarm` skills —
  conductor replaced them. Good reason to retire it.
- pomotodo e2e history: built first via a cmux browser harness, later migrated to Playwright
  (commit d39f905). The post's "cmux built the e2e first" framing is true to history.
- Conductor model: plan → exec → verify over a repo-local spec folder (PRODUCT/TECH/FINDINGS/TASKS),
  dispatches tasks to fresh-context subagents by `backend` (codex/opencode/cursor/omp/claude),
  appends a status history to FINDINGS `## Execution Log`. Matches the post's description.

## Knowledge Updates

- User decisions (this session): remove `dot_claude_example`; build a NEW public GitHub repo for
  sharing only `cmux` (oss) + `conductor` (personal); post is LinkedIn long-form, draft-only
  (user posts manually).
- Install convention: oss = source/target meta pointer (pull from upstream); personal = full copy.

## Drift

- None. (cmux upstream source URL is an open detail to resolve at exec, not a conflict — see assumption in PRODUCT.)

## Durable Candidates

- The cmux→Playwright e2e migration and the conductor-drove-the-whole-build fact are already
  captured in the repo (CLAUDE.md + spec folders); no new long-term memory needed.

## Execution Log

Append-only. One entry per status transition; exec writes these.

### [2026-06-18 17:14] T1 — in_progress
- status: in_progress
- backend: claude
- contract_refs: VAL-DISS-002
- tests_run: not run yet
- evidence: cmux source resolved = cmux.app desktop (cmux.com) → installs to ~/.claude/skills/cmux. conductor full-copied from ~/.claude/skills/conductor. Repo name default claude-skills.
- run_path: runs/T1/

### [2026-06-18 17:14] T1 — done
- status: done
- backend: claude
- contract_refs: VAL-DISS-002
- tests_run: `ls skills/oss skills/personal` → cmux / conductor; `make list-skills` → exit 0, lists both. PASS.
- evidence: ~/workspace/claude-skills scaffolded; oss/cmux/SOURCE.md pointer, personal/conductor full copy (SKILL.md + references/), README + Makefile + LICENSE + .gitignore.
- run_path: runs/T1/

### [2026-06-18 17:20] T2 — done
- status: done
- backend: claude
- contract_refs: VAL-DISS-003
- tests_run: `gh repo view tedzhao226/claude-skills` → exists, public. PASS.
- evidence: live at https://github.com/tedzhao226/claude-skills (master pushed via ssh). gh token scopes = gist,read:org,repo — NO delete_repo (T3 needs `gh auth refresh -s delete_repo`).
- run_path: runs/T2/

### [2026-06-18 17:24] scope addition (user) — codex plugin + VAL-DISS-005
- status: replanned
- evidence: user asked to also share the codex plugin and mention it in the post. Codex is a CC PLUGIN (`codex@openai-codex`, marketplace `openai/codex-plugin-cc`), not a skill → new `plugins/` tier with marketplace-install pointer, not a folder copy. Added VAL-DISS-005 to PRODUCT; plugins/codex/INSTALL.md + README plugins section committed and pushed. T4 redraft must add a codex-plugin line and match the user's raw voice.

### [2026-06-18 17:26] T2 — done (VAL-DISS-005 met)
- status: done
- backend: claude
- contract_refs: VAL-DISS-005
- tests_run: `test -f plugins/codex/INSTALL.md` ok; README has plugins tier; `ls skills/oss skills/personal` = cmux / conductor only. PASS.
- evidence: codex plugin tier pushed (2nd commit).

### [2026-06-18 17:27] T4 — done
- status: done
- backend: claude
- contract_refs: VAL-DISS-001, VAL-DISS-004
- tests_run: `grep -c '\[REPO_URL\]'` → 0; live URL present (2x); sections cmux/conductor/codex/token/dopamine/#tag all present. PASS.
- evidence: post rewritten in user's raw voice (short lines/bullets/lowercase), codex-plugin line added, live repo URL embedded.
- run_path: runs/T4/

### [2026-06-18 17:30] T3 — replanned (user kept GitHub repo)
- status: replanned
- evidence: user opted to KEEP `tedzhao226/dot_claude_example` on GitHub (not delete) and archive the local clone only. Supersedes the original GitHub-deletion sub-assertion of VAL-DISS-003; PRODUCT updated. Side benefit: avoids the `delete_repo` scope refresh entirely.

### [2026-06-18 17:30] T3 — done
- status: done
- backend: claude
- contract_refs: VAL-DISS-003
- tests_run: `test ! -e ~/workspace/dot_claude_example && test -e ~/workspace/.archive/dot_claude_example` → PASS. Pre-removal safety: clone was 0 ahead/0 behind origin (one uncommitted settings.json tweak, preserved by the move).
- evidence: `mv ~/workspace/dot_claude_example ~/workspace/.archive/dot_claude_example`; GitHub repo retained by user choice.
- run_path: runs/T3/

### [2026-06-18 18:20] T5 — done (published to Quartz blog)
- status: done
- backend: claude
- contract_refs: VAL-DISS-001
- tests_run: `cd ~/workspace/blog && npx quartz build` → 0 errors, 36 files emitted; post HTML + auto OG-image present; 7 `![[]]` embeds resolved to <img>, 0 unresolved wikilinks. PASS.
- evidence: blog is Quartz (Obsidian-native MD) → tedzhao226.github.io. New post content/posts/202606181714-vibe-coding-pomodoro-full-ai-slop-stack.md (Quartz frontmatter: title/date/draft/tags/description), 7 images copied to content/attachments/. Committed + pushed main f8d9568; deploy.yml (Pages) run in_progress at report time. Live URL: https://tedzhao226.github.io/posts/202606181714-vibe-coding-pomodoro-full-ai-slop-stack
- run_path: runs/T5/

### [2026-06-18 18:10] post-exec — Codex second-opinion review + fixes
- status: done (artifact edit)
- backend: codex (codex:codex-rescue, clean context) → review.log in runs/codex-review-article/
- evidence: verdict "ship after small fixes." Applied all: (1) cmux TUI mechanism grounded with "tmux send-keys"; (2) "parallel batches" clarified to real concurrency (conductor dag runs independent tasks at the same time); (3) no-JS tension acknowledged (agents wrote JS, spec = ground truth, author reviewed/debugged); + nice-to-haves: italic dek "shipped a full-stack app without learning the stack", surfaced "28 spec folders" early (trimmed the later dup), confirmed GitHub link sits before the closer. Also added cmux docs reference (tmux-style windows/panes/surfaces, https://cmux.com/docs). 0 em-dashes preserved.

### [2026-06-18 17:40] post-exec — engage post extended to long-form article
- status: done (artifact edit, outside the T1-T4 ledger)
- backend: claude
- evidence: user asked to grow the post into a Medium/LinkedIn article on WHY conductor + cmux are powerful. Added sections: conductor = DAG orchestration + internal spec creator (PRODUCT/TECH, idea attributed to Warp's OSS setup) + append-only findings & per-subagent runs/ working memory; cmux = cross-agent context sharing with 3 scenes (opencode fetch-via-cmux, cmux browser e2e harness, drive `claude -p` via TUI/tmux for CLI-less agents); kept model-portfolio section. Note had no specs/CLAUDE.md or in-repo Warp ref → Warp lineage phrased as the user's attribution, not a citation. Same file, voice preserved.
