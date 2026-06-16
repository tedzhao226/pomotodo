"""drop block archived flag (soft delete reversed; history delete is now hard)

Revision ID: 0007_drop_block_archived
Revises: 0006_break_state
Create Date: 2026-06-16

"""

import sqlalchemy as sa

from alembic import op

revision = "0007_drop_block_archived"
down_revision = "0006_break_state"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("blocks", "archived")


def downgrade() -> None:
    op.add_column(
        "blocks",
        sa.Column(
            "archived",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
