"""drop tasks.blocks_override

The manual per-task done-count override masked the real completed-block count:
editing a task froze its current count into the override, so later pomos could
never move it ("no credit after pomo"). blocks_done is now always the live
completed-block count; the column is dead. Dropping it also clears every stuck
override in one step.

Revision ID: 0011_drop_blocks_override
Revises: 0010_block_timer
Create Date: 2026-06-25

"""

import sqlalchemy as sa

from alembic import op

revision = "0011_drop_blocks_override"
down_revision = "0010_block_timer"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("tasks", "blocks_override")


def downgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column("blocks_override", sa.Integer(), nullable=True),
    )
