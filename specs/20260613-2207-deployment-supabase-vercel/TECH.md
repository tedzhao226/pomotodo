# Deployment (Supabase + Vercel) — Tech Spec

Product spec: specs/20260613-2207-deployment-supabase-vercel/PRODUCT.md

## Problem

The backend currently serves the frontend same-origin and assumes a co-located Postgres.
Splitting the frontend onto Vercel introduces a cross-origin API call (CORS + a configurable
API base URL), and the DB moves to Supabase (TLS, possibly a connection pooler).

## Relevant Code

- `app/config.py:6-15` — `Settings.database_url`; add `cors_origins`.
- `app/main.py:1-18` — `FastAPI()`, router include, `/static` mount, index route; add CORS
  and decide static serving.
- `app/main.py:13,17-18` — `/static` mount + `index()` `FileResponse`; these move to Vercel.
- `docker/entrypoint.sh` — already runs `alembic upgrade head` before serving.
- `docker-compose.yml` — becomes dev-only.
- `static/app.js:160-174` — `api()`; needs a configurable base URL.
- `Dockerfile` — multi-stage image reused as-is by the host.

## Current State

FastAPI serves `index.html` and `/static` same-origin; `api()` calls relative `/api`.
The DB comes from docker-compose; the entrypoint migrates on boot.

## Implementation

### Supabase (DB)
- Provision a project; take the Postgres connection string. A long-running host can use the
  direct connection or the **session** pooler; append `sslmode=require`.
- Set `POMOTODO_DATABASE_URL` on the host; `alembic upgrade head` runs on deploy (entrypoint).

### Backend on Render
- Deploy the existing `Dockerfile`; set env: `POMOTODO_DATABASE_URL`, the Supabase JWT secret
  (from the auth spec), `POMOTODO_CORS_ORIGINS`; health check `GET /`.
- Add `CORSMiddleware` in `app/main.py` allowing the Vercel origin(s) from `cors_origins`,
  with `Authorization` in allowed headers.
- Make FastAPI API-only for prod: keep the `/static` mount + index route for local dev (behind
  a flag or simply unused in prod since Vercel serves the assets).
- Alternatives to Render: Fly.io (`flyctl`, more control) or Railway.

### Frontend on Vercel
- Deploy `static/` as a static site.
- Introduce an API base: a small `static/config.js` (or build-time env) sets `window.API_BASE`;
  change `api()` to prefix it (default `""` keeps local same-origin working).
- Add `vercel.json` for headers and SPA fallback to `index.html`.

### Config
- Extend `.env.example` with Supabase URL + anon key, JWT secret, `POMOTODO_CORS_ORIGINS`,
  and the frontend `API_BASE`.

## Edge Cases

- CORS preflight must allow the `Authorization` header and the methods used (GET/POST/PATCH/DELETE).
- Bearer auth is cookie-less, so there are no SameSite/cookie-domain issues across origins.
- If the **transaction** pooler is used, disable prepared statements (psycopg
  `prepare_threshold=None` / SQLAlchemy `NullPool`); the session pooler/direct avoids this.
- On a multi-instance deploy, run `alembic upgrade head` as a single release step, not
  concurrently per instance.

## Tests

- `uv run pytest` is unchanged (logic is host-agnostic).
- Manual: backend on Render against Supabase; frontend on Vercel; a cross-origin authenticated
  request (with `Authorization`) succeeds; `alembic upgrade head` applies cleanly on Supabase.
