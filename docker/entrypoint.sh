#!/bin/sh
set -e

# Apply schema migrations before serving (DB is healthy via compose depends_on).
alembic upgrade head

# Seed mock data only when explicitly requested (dev env).
if [ -n "$POMOTODO_SEED" ]; then
  python -m scripts.seed
fi

exec "$@"
