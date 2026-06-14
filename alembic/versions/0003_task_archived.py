"""add task archived flag (soft delete)

Revision ID: 0003_task_archived
Revises: 0002_task_note
Create Date: 2026-06-14

"""

import sqlalchemy as sa

from alembic import op

revision = "0003_task_archived"
down_revision = "0002_task_note"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column(
            "archived",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.create_index("ix_tasks_archived", "tasks", ["archived"])


def downgrade() -> None:
    op.drop_index("ix_tasks_archived", table_name="tasks")
    op.drop_column("tasks", "archived")
