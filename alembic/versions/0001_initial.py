"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-13

"""

import sqlalchemy as sa

from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("estimate_blocks", sa.Integer(), nullable=True),
        sa.Column("blocks_override", sa.Integer(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default="active",
        ),
        sa.Column(
            "bucket",
            sa.String(length=16),
            nullable=False,
            server_default="today",
        ),
        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False
        ),
    )
    op.create_table(
        "task_tags",
        sa.Column(
            "task_id",
            sa.Integer(),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("tag", sa.String(length=64), primary_key=True),
    )
    op.create_table(
        "blocks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "task_id",
            sa.Integer(),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("duration_min", sa.Integer(), nullable=False),
        sa.Column(
            "started_at", sa.DateTime(timezone=True), nullable=False
        ),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "completed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.create_index("ix_blocks_task_id", "blocks", ["task_id"])
    op.create_index(
        "ix_tasks_bucket_sort", "tasks", ["bucket", "sort_order"]
    )


def downgrade() -> None:
    op.drop_index("ix_tasks_bucket_sort", table_name="tasks")
    op.drop_index("ix_blocks_task_id", table_name="blocks")
    op.drop_table("blocks")
    op.drop_table("task_tags")
    op.drop_table("tasks")
