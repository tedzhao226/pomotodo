# Auth & Multi-tenant — Tech Spec

Product spec: specs/20260613-2207-auth-multitenant/PRODUCT.md
Human setup: specs/20260613-2207-auth-multitenant/HUMAN.md
Background: specs/20260613-2207-auth-multitenant/EDUCATION.md
Visual overview: specs/20260613-2207-auth-multitenant/overview.html

This spec was re-written after an audit (the original predated the history view and
the soft-delete `Task.archived` flag, used HS256, and missed several repository
methods). It reflects the decisions locked below.

## Problem

Every repository query selects all rows and the API trusts any caller.
Identity must be added without rolling our own credential storage (Supabase owns it),
and every read/write must be constrained to the caller's `user_id`.

## Decisions

- **JWT verification: JWKS / asymmetric** (ES256/RS256), not an HS256 shared secret.
  The backend holds no forge-capable secret and rotates keys by `kid`. Requires the
  Supabase project to use asymmetric signing keys (see HUMAN.md). HS256 is the
  fallback only if a project cannot enable asymmetric keys.
- **Frontend Supabase config: public `GET /api/config`** returning
  `{supabase_url, anon_key}` (both public values). Env-driven; no templating.
- **Database: start fresh.** No backfill / no backward-compat. Truncate the
  disposable data, then add `user_id NOT NULL`.

## Security boundary

The backend connects to Postgres **directly** (`database_url`), not via Supabase
PostgREST — Postgres RLS is therefore **not** the enforcement layer. The repository
`user_id` filters below are the security boundary.

## Current State

No user concept exists. The `Repository` constructor takes only a `Session`; queries
are global. `api()` sends JSON with no auth header; 401 is never returned.

## Implementation

### Database

- Alembic revision `0004_user_id` (head is `0003_task_archived`): truncate `blocks`,
  `task_tags`, `tasks`, then add `user_id` (`TEXT NOT NULL`) to `tasks` and `blocks`.
- Indexes: `ix_tasks_user_id`, composite `(user_id, bucket, sort_order)`,
  `ix_blocks_user_id`.
- `task_tags` stays keyed by `task_id` — ownership inherited through the task.
- Identity lives in Supabase `auth.users`; no local users table. `user_id` is the
  JWT `sub` claim (a UUID string).
- Models: add `user_id: Mapped[str]` to `Task` and `Block` (`app/models.py`).

### Backend verification (`app/auth.py`, new)

- FastAPI dependency `get_current_user_id` reads `Authorization: Bearer <token>`.
- Verify with JWKS: a cached `jwt.PyJWKClient(jwks_url)` supplies the public key
  matching the token `kid`; decode with `algorithms=["ES256","RS256"]` and check
  `aud` (`authenticated`) and `iss` (`{supabase_url}/auth/v1`). Return `sub`.
- Missing / malformed / expired / wrong `aud`/`iss` → `HTTPException(401)`.
- Add `PyJWT[crypto]` to `pyproject.toml`.

### Config (`app/config.py`)

Add env-only settings (`POMOTODO_` prefix, kept in `.env`, never committed):
`supabase_url`, `supabase_anon_key`, `supabase_jwks_url`
(derive `{url}/auth/v1/.well-known/jwks.json` if unset), `supabase_jwt_audience`
(default `authenticated`), `supabase_jwt_issuer` (`{url}/auth/v1`), and
`cors_origins`. Update `.env.example` with placeholders. No JWT secret stored.

### DI (`app/api.py`)

Inject the user once, in `get_repository` — do not touch every route:

```python
def get_repository(session=Depends(get_db),
                   user_id: str = Depends(get_current_user_id)) -> Repository:
    return Repository(session, user_id)
```

`get_service` and the routes are unchanged. Add `GET /api/config` (no auth)
returning `{supabase_url, anon_key}`.

### Repository scoping (`app/repository.py`)

Constructor change is the lever: `__init__(self, session, user_id)`. Then:

- Stamp `user_id` on create: `create_task`, `create_block`.
- Add `… == self._user_id` to every read/mutate: `list_tasks`, `task_ids_in_bucket`,
  `_next_sort_order`, `reorder`, `delete_completed_tasks`, `count_tasks`,
  `get_task_block_stats` (in SQL, before `group_by`), `get_tag_summaries` (constrain
  via the joined `Block`/`Task`, since `task_tags` has no `user_id`),
  `get_completed_blocks`, `get_completed_blocks_page`, `count_completed_blocks`,
  `get_all_tasks_with_stats`, `get_running_block`.
- **PK-by-id lookups must also be scoped** — `session.get` ignores `user_id`, so a
  cross-user id would leak: `_get`, `get_block`, `end_block`, `set_tags` switch to a
  `select(...).where(id == …, user_id == self._user_id)` lookup. A cross-user id
  returns `None` → the service raises `NotFoundError` → 404.

`app/service.py` needs no signature change — isolation is inherited from the injected
repository. `start_block` already calls `get_task` first (now user-scoped).

### Frontend (`static/index.html`, `static/app.js`, `static/i18n.js`)

- Load the Supabase JS client (CDN ESM). Boot: `GET /api/config` → init client →
  `supabase.auth.getSession()`. Gate all `/api/*` calls behind a session (the startup
  `syncNow()` must not fire until a session exists).
- A sign-in view (Google + email/password) shows when there is no session; the app UI
  is hidden until signed in.
- `api()` attaches `Authorization: Bearer <access_token>`; a `401` clears the session
  and returns to sign-in (Supabase handles refresh).
- Replace the static `awesomeuser ▾` with a real user menu (email + Sign out →
  `supabase.auth.signOut()`). Add `state.user`/session and i18n strings.

### Cross-origin (forward-compat with the deployment spec)

The deployment spec serves the frontend on Vercel/Cloudflare and the API on Render,
cross-origin. So `app/main.py` adds `CORSMiddleware` allowing `cors_origins` and the
`Authorization` header (bearer is cookie-less → no SameSite issues), and `api()`
prefixes a configurable `API_BASE` (default `""` keeps local same-origin working).

## Edge Cases

- Token refreshed/expired mid-session: rely on the Supabase client refresh; hard 401
  → re-auth.
- First-login user: empty dashboard renders cleanly.
- Cross-user ids on `PATCH /tasks/{id}`, `/tasks/order`, `PATCH /blocks/{id}`,
  note/move, `DELETE /tasks/{id}` → 404 (not 403) so ids can't be enumerated.
- Resume-on-reload running block scoped to the user (`get_running_block`).
- `aud`/`iss` mismatch rejects a token meant for another Supabase project (e.g. a dev
  token replayed against prod).

## Tests

- Repository isolation: user A cannot read or mutate user B's tasks/blocks; cross-user
  ids → 404.
- Auth dependency: rejects missing/garbage/expired tokens (mock the JWKS verify),
  accepts a valid one and yields `sub`.
- Signed-in round-trip: create → dashboard/history scoped to that user.
- Update `tests/` fixtures to construct the repository with a `user_id`; add a
  second-user fixture.
- Verify: `uv run pytest`; then a manual Supabase login confirming the dashboard only
  shows that user's data (needs HUMAN.md setup).
