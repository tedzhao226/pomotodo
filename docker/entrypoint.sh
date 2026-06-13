#!/bin/sh
set -e

# Apply schema migrations before serving (DB is healthy via compose depends_on).
alembic upgrade head

exec "$@"
