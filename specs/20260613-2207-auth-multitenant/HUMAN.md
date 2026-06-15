# Auth & Multi-tenant — Human Actions

Steps only a human can do (Supabase / Google consoles, secrets).
Code + tests do not need these — tests mock JWKS, so the build proceeds in parallel.
These gate only real Google login and end-to-end manual verification.

## Before end-to-end verification

### 1. Create two Supabase projects

Create `pomotodo-dev` and `pomotodo-prod` (separate projects — separate signing
keys, data, OAuth config).
A dev token must never authenticate against prod.

### 2. Enable asymmetric signing keys (per project)

Auth settings → enable asymmetric (ECC/RSA) JWT signing keys.
The backend verifies via JWKS, not a shared HS256 secret.
If a project is stuck on HS256, flag it — the verify path must switch.
Background on why: `EDUCATION.md`.

### 3. Configure Google provider (per project)

Create a Google Cloud OAuth client (client id + secret) in Google Cloud Console.
Paste into Supabase → Auth → Providers → Google.

### 4. Set OAuth redirect URLs (per project)

- dev: `http://localhost:<port>` plus the dev frontend URL.
- prod: only the prod frontend URL.

### 5. Collect env values into `.env` (dev) / host env (prod)

```
POMOTODO_DATABASE_URL=...
POMOTODO_SUPABASE_URL=...
POMOTODO_SUPABASE_ANON_KEY=...
POMOTODO_CORS_ORIGINS=...
```

No JWT secret is stored anywhere (JWKS verifies with public keys).
Never commit `.env`; `.env.example` documents placeholders only.

## Deferred (production deploy only)

Not needed to build or test locally.

- Deploy backend to Render (existing `Dockerfile`; migrations on release).
- Deploy frontend `static/` to Vercel or Cloudflare Pages.
- Set prod env vars on each host.
- Point the prod Supabase OAuth redirect at the deployed frontend URL.

## Division of labor

| Done by agent (no Supabase needed) | Done by human |
|------------------------------------|---------------|
| Migration, models, repository scoping | Create Supabase projects |
| `app/auth.py` (JWKS verify) | Enable asymmetric keys |
| DI wiring, `GET /api/config`, CORS | Configure Google OAuth |
| Frontend Supabase client + sign-in UI | Set redirect URLs |
| Tests (mock JWKS → green offline) | Fill `.env` / host env |
