from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    estimate_blocks: Mapped[int | None] = mapped_column(Integer, default=None)
    blocks_override: Mapped[int | None] = mapped_column(Integer, default=None)
    status: Mapped[str] = mapped_column(String(16), default="active")
    bucket: Mapped[str] = mapped_column(String(16), default="today")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    note: Mapped[str] = mapped_column(Text, default="")
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    tags: Mapped[list["TaskTag"]] = relationship(
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TaskTag.tag",
    )
    blocks: Mapped[list["Block"]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )


class TaskTag(Base):
    __tablename__ = "task_tags"

    task_id: Mapped[int] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True
    )
    tag: Mapped[str] = mapped_column(String(64), primary_key=True)

    task: Mapped[Task] = relationship(back_populates="tags")


class Block(Base):
    __tablename__ = "blocks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True
    )
    duration_min: Mapped[int] = mapped_column(Integer)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    note: Mapped[str] = mapped_column(Text, default="")

    task: Mapped[Task | None] = relationship(back_populates="blocks")


class BlockTouch(Base):
    # A task touched during a block (a credit candidate). block.task_id is the
    # current active task; this set is everything the block has touched, so a
    # mid-block reload restores the full completion checklist.
    __tablename__ = "block_touches"

    block_id: Mapped[int] = mapped_column(
        ForeignKey("blocks.id", ondelete="CASCADE"), primary_key=True
    )
    task_id: Mapped[int] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True
    )


class BreakState(Base):
    # Singleton (id == 1): the running break, mirroring the client's
    # {mode, deadline} so a break follows the user across devices. No task.
    __tablename__ = "break_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    mode: Mapped[str] = mapped_column(String(16))
    deadline_ms: Mapped[int] = mapped_column(BigInteger)
