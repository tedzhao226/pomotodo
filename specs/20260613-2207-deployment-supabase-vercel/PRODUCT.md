# Deployment (Supabase + Vercel) — Product Spec

Links: none provided.

## Summary

Run the three tiers as managed services: Postgres + Auth on Supabase, the FastAPI backend
on a Python host (Render), and the static frontend on Vercel.
This replaces the local docker-compose stack for production while keeping it for dev.

## Problem

Today everything is one container — FastAPI serves the static frontend and talks to a
local Postgres from docker-compose.
That shape can't deploy to the chosen managed stack (Supabase / Vercel / a Python host).

## Goals

- Postgres on Supabase via `DATABASE_URL`; Alembic migrations run on deploy.
- Frontend on Vercel calling the API cross-origin.
- Reproducible, documented environment configuration.
- Local docker-compose continues to work for development.

## Non-goals

- CI/CD pipeline design, custom domains/DNS, autoscaling.
- The Supabase-direct (PostgREST/RLS, drop-FastAPI) rewrite.

## User Experience

No user-facing change beyond the app being reachable at its production URLs.

## Sequencing

Do this after auth/multi-tenant (so the deployed app is already user-scoped and Supabase is
already in the picture for Auth).
