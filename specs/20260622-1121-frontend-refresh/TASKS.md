# Tasks: Frontend refresh — direction exploration

**Goal**: Decide one intentional refinement direction for the UI + a prioritized,
token-level change list — no production code shipped here.
**Spec Folder**: /Users/ted/workspace/pomotodo/specs/20260622-1121-frontend-refresh
**Acceptance**: /Users/ted/workspace/pomotodo/specs/20260622-1121-frontend-refresh/PRODUCT.md (## Acceptance, VAL-REFRESH-*)

## Tasks

Execution: serial

```text
tasks[4]{id,title,depends_on,status,size,type,file,contract_refs,acceptance,write_set,tier,run_path,result}:
  T1,Capture screenshots + diagnose tokens,,done,M,research,frontend/style.css,VAL-REFRESH-001,"ls runs/T1/*.png",FINDINGS.md,research,runs/T1/,3 screenshots + 19 token-bound issues (D1-6/M1-5/S1-4/H1-4)
  T2,Apply frontend-design skill draft,T1,done,M,research,,VAL-REFRESH-002,"grep -q Draft FINDINGS.md",FINDINGS.md,deep,runs/T2/,Draft direction written; core tension = refine cream/tomato default w/o re-theme
  T3,Gather codex + cursor perspectives,T2,done,M,review,,VAL-REFRESH-002,"ls runs/T3",FINDINGS.md,review,runs/T3/,codex+cursor both: kill 2nd webfont + dial; codex measured muted passes (D4 fix=size)
  T4,Synthesize DIRECTION + change list,T3,done,M,research,,"VAL-REFRESH-002,VAL-REFRESH-003","ls DIRECTION.md",DIRECTION.md,deep,runs/T4/,DIRECTION.md: 1 direction + reconciliation + 11-row prioritized change list (5 deferred)
```

### T1: Capture screenshots + diagnose tokens

Run the app (reuse the Playwright webServer infra: throwaway DB + uvicorn on 8788, see
CLAUDE.md "Full testing"). Screenshot main / stats / history at desktop width into
`runs/T1/`. Inventory `:root` tokens in `frontend/style.css` and fonts in `index.html`.
Fill `FINDINGS.md` ## Diagnosis with concrete, token-bound issues per view (typography,
spacing rhythm, color, hierarchy). No vague adjectives. (VAL-REFRESH-001)

### T2: Apply frontend-design skill draft

Invoke `frontend-design:frontend-design` against the diagnosis + screenshots. Draft one
direction: mood/reference, type system (family/scale/weights), color refinement, spacing
rhythm, density. Write it into `FINDINGS.md` ## Draft direction. (VAL-REFRESH-002)

### T3: Gather codex + cursor perspectives

Get two independent external reads on the current screenshots + the T2 draft: **codex**
(`codex-review` / `codex:codex-rescue` → codex CLI) and **cursor** (`cursor-agent` CLI).
Prompt each for: what reads off, their direction, what to change first. Save raw replies
under `runs/T3/`; distill into `FINDINGS.md` ## External perspectives incl. where they
agreed / changed the call. (VAL-REFRESH-002)

### T4: Synthesize DIRECTION + change list

Reconcile skill guidance + both external reads into `DIRECTION.md`: one recommended
direction with rationale and the external-review reconciliation, ending in a prioritized,
token-level ## Change list against `frontend/style.css` + `frontend/index.html` — each
item small enough to seed one task in a follow-up implementation spec. (VAL-REFRESH-002,
VAL-REFRESH-003)
