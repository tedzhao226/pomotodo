# Auth & Multi-tenant — Product Spec

Links: none provided.

## Summary

Users sign in with Google or email/password through Supabase Auth.
Every task, block, and (eventually) setting becomes private to the signed-in user.
An unauthenticated visitor sees a sign-in screen instead of the app.

## Problem

The app is single-user and global: all data is shared, there is no identity, and it
cannot be exposed publicly without leaking everyone's todos into one list.

## Goals

- Google and email/password sign-in backed by Supabase Auth.
- Per-user isolation of all tasks and blocks.
- An API that authenticates every request and rejects cross-user access.
- Sign-out.

## Non-goals

- Roles, teams, sharing, or organization accounts.
- Server-side persistence of settings/order (tracked separately).
- Custom password-reset UI beyond Supabase's defaults.

## User Experience

### Sign-in

A sign-in view gates the whole app: a Google button plus an email/password form.
After sign-in the session persists across reloads via the Supabase JS session.

### Signed-in app

The static `awesomeuser ▾` menu becomes a real user menu showing the signed-in email
and a Sign out action.
A first-time user lands on an empty dashboard (no tasks), not an error.

### Boundaries

A user only ever sees and mutates their own data.
Requests that reference another user's task/block id are rejected as not-found.

## Sequencing

This is the first change of the productionization set; it adds `user_id` scoping that
the deployment, i18n, and tag-stats specs build on top of.
