"""block_touches: persist the touched-task set per block

Revision ID: 0009_block_touches
Revises: 0008_block_task_nullable
Create Date: 2026-06-18

"""

import sqlalchemy as sa

from alembic import op

revision = "0009_block_touches"
down_revision = "0008_block_task_nullable"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "block_touches",
        sa.Column(
            "block_id",
            sa.Integer(),
            sa.ForeignKey("blocks.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "task_id",
            sa.Integer(),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )


def downgrade() -> None:
    op.drop_table("block_touches")
