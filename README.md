# Pomotodo

Full-stack pomodoro timer and todo tracker — focus blocks, task sync, history, and tags.

## Stack

- **Backend**: FastAPI (router / service / repository), SQLAlchemy, Alembic migrations, Pydantic schemas
- **Frontend**: vanilla JS SPA with i18n
- **TUI**: terminal client over the same API
- **Infra**: Docker + Compose (Postgres staging), `uv` packaging
- **Tests**: pytest (unit/integration) + Vitest + Playwright e2e

## Setup

```bash
uv sync
```

## Run

```bash
uv run uvicorn backend.main:app --reload
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

## Staging (`pomo.staging`)

Local staging runs via Docker Compose (Postgres + the app):

```bash
cp .env.example .env                              # set POSTGRES_* (first time)
docker compose -f docker-compose.staging.yml up -d
```

The app binds host port **80** (for the friendly hostname) and **8001**. Map the
hostname to loopback once (this machine only):

```bash
echo "127.0.0.1 pomo.staging" | sudo tee -a /etc/hosts
```

Then open [http://pomo.staging](http://pomo.staging) (or `http://localhost:8001`).

## Test

```bash
uv run pytest -q
```

## Task syntax

- `#tag` — add one or more tags
- `*N` — optional estimated pomodoro blocks (first `*N` wins)
- Everything else becomes the task name

Example: `PTE #learn *5`
