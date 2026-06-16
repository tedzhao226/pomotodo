"""add block note (work-session record)

Revision ID: 0004_block_note
Revises: 0003_task_archived
Create Date: 2026-06-16

"""

import sqlalchemy as sa

from alembic import op

revision = "0004_block_note"
down_revision = "0003_task_archived"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "blocks",
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("blocks", "note")
