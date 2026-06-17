"""make blocks.task_id nullable for taskless pomodoro starts

Revision ID: 0008_block_task_nullable
Revises: 0007_drop_block_archived
Create Date: 2026-06-17

"""

import sqlalchemy as sa

from alembic import op

revision = "0008_block_task_nullable"
down_revision = "0007_drop_block_archived"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("blocks") as batch_op:
        batch_op.alter_column("task_id", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("blocks") as batch_op:
        batch_op.alter_column("task_id", existing_type=sa.Integer(), nullable=False)
