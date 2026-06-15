# JWT Signing & Verification — Background

Why this project verifies Supabase tokens with JWKS (asymmetric keys) instead of a
shared HS256 secret, and what that means in practice.

## What a JWT is here

When a user signs in, Supabase Auth issues an **access token**: a JWT (JSON Web
Token).
The token has three parts joined by dots — `header.payload.signature`.

- Header: which algorithm signed it, and (for asymmetric) a key id `kid`.
- Payload: claims like `sub` (the user id), `aud`, `iss`, `exp`.
- Signature: proof the token was issued by Supabase and not tampered with.

The frontend sends this token on every API call as `Authorization: Bearer <token>`.
The backend's only job is to **verify the signature** and trust the claims inside.
Verification is what turns an opaque string into a trusted `user_id`.

## Is the JWT per-user?

Yes — the **token** is per-user, but the **signing key** is not.

- **One signing key per Supabase project** signs *every* user's token. There is not
  a key per user. The asymmetric key enabled in HUMAN.md is a single project-wide
  key (rotated over time, selected by `kid`).
- **Each token is per-user and per-session.** Every login (and every silent refresh)
  mints a fresh JWT whose `sub` claim is that user's id, with its own `exp`. User A's
  token carries A's `sub`; user B's carries B's. Same project, same signing key,
  different contents.

So the two concerns are separate:

```text
signature  → proves authenticity  ("a real Supabase token, not forged")  [shared key]
sub claim  → provides identity    ("which user this is")                  [per user]
```

The backend verifies the signature with the one public key, then reads `sub` to know
*which* user is calling. The same key verifies everyone; the `sub` inside is what
differs. That `sub` becomes `user_id` and scopes every repository query — which is
why the signing key being shared does not weaken per-user isolation: a token's `sub`
cannot be changed without breaking the signature.

## The two ways to sign

### HS256 — symmetric (one shared secret)

One secret signs the token *and* verifies it.
The same key does both, so anyone who can verify can also forge.

```text
Supabase  --sign(secret)-->  token  --verify(secret)-->  Backend
```

To verify, the backend must hold that secret.
This is the legacy Supabase default.

### RS256 / ES256 — asymmetric (key pair)

A **private** key signs; a different **public** key verifies.
The private key never leaves Supabase.
The public key is published and is safe to share.

```text
Supabase  --sign(private key)-->  token  --verify(public key)-->  Backend
```

The backend fetches the public key from Supabase's **JWKS endpoint**
(`/auth/v1/.well-known/jwks.json`) — a JSON document listing the current public
keys, each tagged with a `kid`.
The backend reads the token's `kid`, picks the matching public key, and verifies.

## Why asymmetric / JWKS for this project

This app is going commercial and multi-tenant, so the threat model matters.

1. **No forge-capable secret on the backend.**
   With HS256, the verification secret is also the *signing* secret.
   If the backend host, a log, or an env dump leaks it, an attacker can mint a valid
   token for **any** user id and impersonate anyone.
   With asymmetric keys the backend only ever holds a *public* key — useless for
   forging.

2. **Key rotation without downtime.**
   The JWKS endpoint can list several keys at once.
   Supabase rotates the signing key; tokens carry the `kid` of whichever key signed
   them; the backend selects by `kid`.
   No coordinated secret swap, no tokens breaking mid-rotation.

3. **Multiple verifiers scale cleanly.**
   Any number of services (API, workers, future microservices) can verify by
   fetching public keys — none need a shared secret distributed and guarded.

The cost is small: the backend caches the JWKS and refreshes it when it sees an
unknown `kid`. About fifteen lines with `PyJWT` + `PyJWKClient`.

## How the backend verifies (this project)

`app/auth.py` does, per request:

1. Read `Authorization: Bearer <token>`; missing → `401`.
2. Use a cached `PyJWKClient(jwks_url)` to get the public key matching the token
   `kid`.
3. Decode with `algorithms=["ES256", "RS256"]` and check:
   - signature (via the public key),
   - `exp` not expired,
   - `aud` equals the expected audience (`authenticated`),
   - `iss` equals the project issuer (`{SUPABASE_URL}/auth/v1`).
4. Return the `sub` claim as `user_id`.
5. Any failure (bad signature, expired, wrong `aud`/`iss`, garbage) → `401`.

The `user_id` flows into the repository, which scopes every query to it.
Checking `aud` and `iss` matters: it rejects a token that is validly signed but
meant for a *different* Supabase project or audience — e.g. a dev token replayed
against prod.

## The "stuck on HS256" caveat

Older Supabase projects default to HS256 and have no asymmetric key to publish.
A brand-new project can enable asymmetric signing keys in Auth settings.

If a project cannot be moved to asymmetric keys, `app/auth.py` must fall back to
HS256 verification instead: verify with the project JWT secret
(`algorithms=["HS256"]`, same `aud`/`iss` checks), and that secret becomes a
sensitive env value the backend must hold and guard.
That is the scenario `HUMAN.md` says to flag — the verification path changes.

## Glossary

- **JWT**: signed token carrying user claims.
- **Claim**: a field in the token payload (`sub`, `aud`, `iss`, `exp`).
- **`sub`**: subject — the Supabase user id; this app's `user_id`.
- **`aud` / `iss`**: intended audience / issuer; checked to reject tokens from
  another project or audience.
- **JWKS**: JSON Web Key Set — the endpoint publishing current public keys.
- **`kid`**: key id in the token header; selects which JWKS key verifies it.
- **Symmetric (HS256)**: one shared secret signs and verifies.
- **Asymmetric (RS256/ES256)**: private key signs, public key verifies.
