"""add break_state singleton (cross-device running break)

Revision ID: 0006_break_state
Revises: 0005_block_archived
Create Date: 2026-06-16

"""

import sqlalchemy as sa

from alembic import op

revision = "0006_break_state"
down_revision = "0005_block_archived"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "break_state",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("mode", sa.String(length=16), nullable=False),
        sa.Column("deadline_ms", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("break_state")
