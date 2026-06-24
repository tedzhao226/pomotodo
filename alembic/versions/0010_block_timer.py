"""add block timer state (absolute deadline + paused remaining)

Lets a running pomodoro rehydrate from an absolute server-side deadline (the same
model breaks already use) instead of the started_at+duration elapsed heuristic,
and lets a paused pomodoro survive a reload.

Revision ID: 0010_block_timer
Revises: 0009_block_touches
Create Date: 2026-06-24

"""

import sqlalchemy as sa

from alembic import op

revision = "0010_block_timer"
down_revision = "0009_block_touches"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Absolute epoch-ms deadline while running; NULL while paused or ended.
    op.add_column(
        "blocks",
        sa.Column("deadline_ms", sa.BigInteger(), nullable=True),
    )
    # Logical seconds left while paused; NULL while running or ended.
    op.add_column(
        "blocks",
        sa.Column("paused_remaining_s", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("blocks", "paused_remaining_s")
    op.drop_column("blocks", "deadline_ms")
