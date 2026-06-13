# Auth & Multi-tenant — Tech Spec

Product spec: specs/20260613-2207-auth-multitenant/PRODUCT.md

## Problem

Every repository query selects all rows and the API trusts any caller.
Identity must be added without rolling our own credential storage (Supabase owns it),
and every read/write must be constrained to the caller's `user_id`.

## Relevant Code

- `app/api.py:27-43` — `get_db` / `get_repository` / `get_service` DI chain; the authed
  user must be injected here so the repository is built per-user.
- `app/api.py:46-145` — every route; each must operate within the user's scope.
- `app/models.py` — `Task` / `Block` / `TaskTag`; add `user_id` to `Task` and `Block`.
- `app/repository.py` — every `select(...)` / mutation; filter by `user_id`.
- `app/service.py:21-` — passes fields through; must forward `user_id` ownership.
- `app/config.py:6-15` — `Settings`; add Supabase JWT verification settings.
- `static/app.js:160-174` — `async function api()`; attach `Authorization: Bearer`.
- `static/app.js:28-46` — `state`; add `user` / session.
- `static/index.html:13,17` — topbar user menu placeholder.

## Current State

No user concept exists.
The repository constructor takes only a `Session`; queries are global.
`api()` sends JSON with no auth header; 401 is never returned.

## Implementation

### Database
- Alembic revision adds `user_id TEXT NOT NULL` to `tasks` and `blocks` with an index on
  each (`user_id`, and `(user_id, bucket, sort_order)` for tasks).
- `task_tags` stays keyed by `task_id` (ownership inherited through the task).
- Identity lives in Supabase `auth.users`; no local users table.
- One-time data migration backfills existing rows to a placeholder owner (or truncates
  dev data, since it is disposable).

### Backend verification
- Add `app/auth.py`: a FastAPI dependency that reads the `Authorization: Bearer` token and
  verifies the Supabase JWT. Supabase signs access tokens with the project JWT secret
  (HS256) — verify with that secret and the expected `aud`/`iss`; return `sub` as `user_id`.
  (If the project uses asymmetric keys, verify via the JWKS endpoint instead.)
- Inject the `user_id` into `get_repository`/`get_service` so the `Repository` is constructed
  with the owner. Repository methods add `Task.user_id == user_id` / `Block.user_id == user_id`
  to every query, and stamp `user_id` on create.
- Missing/invalid/expired token → `HTTPException(401)`.

### Frontend
- Add the Supabase JS client (CDN module). Add a sign-in view (Google + email/password) shown
  when there is no session.
- On auth state change, store the session; `api()` adds `Authorization: Bearer <access_token>`;
  a `401` response forces back to sign-in. Supabase handles token refresh.
- User menu shows email + Sign out (calls `supabase.auth.signOut()` then shows sign-in).

## Edge Cases

- Token refreshed/expired mid-session: rely on the Supabase client's refresh; on a hard 401,
  re-auth.
- First-login user: empty dashboard renders cleanly (no running block, empty buckets).
- Cross-user ids on `PATCH /tasks/{id}`, `/tasks/order`, `/blocks/{id}`, note/move: return
  404 (not 403) so ids can't be enumerated.
- Resume-on-reload running block must be scoped to the user (`get_running_block` filters
  `user_id`).

## Tests

- Repository isolation: user A cannot read or mutate user B's tasks/blocks.
- Auth dependency: rejects missing/garbage/expired tokens (mock the verify), accepts a valid one.
- A signed-in round-trip (create → dashboard scoped to that user).
- Update existing `tests/` fixtures to construct the repository with a `user_id`.
- Verify: `uv run pytest`; manual Supabase login then confirm the dashboard only shows that
  user's data.
