# Pomotodo

Local pomodoro timer and todo tracker.

## Setup

```bash
uv sync
```

## Run

```bash
uv run uvicorn app.main:app --reload
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

## Test

```bash
uv run pytest -q
```

## Task syntax

- `#tag` — add one or more tags
- `*N` — optional estimated pomodoro blocks (first `*N` wins)
- Everything else becomes the task name

Example: `PTE #learn *5`
