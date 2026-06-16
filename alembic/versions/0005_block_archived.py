"""add block archived flag (soft delete)

Revision ID: 0005_block_archived
Revises: 0004_block_note
Create Date: 2026-06-16

"""

import sqlalchemy as sa

from alembic import op

revision = "0005_block_archived"
down_revision = "0004_block_note"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "blocks",
        sa.Column(
            "archived",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("blocks", "archived")
