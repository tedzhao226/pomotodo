from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.models import Block, BlockTouch, BreakState, Task, TaskTag, utcnow


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


class Repository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def _task_to_dict(self, task: Task) -> dict:
        return {
            "id": task.id,
            "name": task.name,
            "estimate_blocks": task.estimate_blocks,
            "blocks_override": task.blocks_override,
            "status": task.status,
            "bucket": task.bucket,
            "sort_order": task.sort_order,
            "note": task.note,
            "created_at": _iso(task.created_at),
            "tags": [tag.tag for tag in task.tags],
        }

    def _next_sort_order(self, bucket: str) -> int:
        current_max = self._session.execute(
            select(func.max(Task.sort_order)).where(Task.bucket == bucket)
        ).scalar_one_or_none()
        return 0 if current_max is None else current_max + 1

    def create_task(
        self,
        name: str,
        estimate_blocks: int | None,
        tags: list[str],
    ) -> dict:
        task = Task(
            name=name,
            estimate_blocks=estimate_blocks,
            status="active",
            bucket="today",
            sort_order=self._next_sort_order("today"),
            tags=[TaskTag(tag=tag) for tag in tags],
        )
        self._session.add(task)
        self._session.flush()
        return self._task_to_dict(task)

    def list_tasks(self, tag: str | None = None) -> list[dict]:
        stmt = select(Task).where(Task.archived.is_(False))
        if tag:
            stmt = stmt.join(Task.tags).where(TaskTag.tag == tag)
        stmt = stmt.order_by(Task.bucket, Task.sort_order, Task.id)
        tasks = self._session.execute(stmt).scalars().unique().all()
        return [self._task_to_dict(task) for task in tasks]

    def _get(self, task_id: int) -> Task | None:
        return self._session.get(Task, task_id)

    def get_task(self, task_id: int) -> dict | None:
        task = self._get(task_id)
        return self._task_to_dict(task) if task is not None else None

    def task_ids_in_bucket(self, bucket: str) -> set[int]:
        rows = self._session.execute(
            select(Task.id).where(
                Task.bucket == bucket, Task.archived.is_(False)
            )
        ).scalars()
        return set(rows)

    def update_task(self, task_id: int, fields: dict) -> dict | None:
        task = self._get(task_id)
        if task is None:
            return None
        target_bucket = fields.get("bucket", task.bucket)
        bucket_changed = "bucket" in fields and fields["bucket"] != task.bucket
        # Finishing a task sinks it below the still-active tasks in its bucket.
        finishing = fields.get("status") == "done" and task.status != "done"
        if bucket_changed or finishing:
            task.sort_order = self._next_sort_order(target_bucket)
        for column, value in fields.items():
            setattr(task, column, value)
        self._session.flush()
        return self._task_to_dict(task)

    def set_tags(self, task_id: int, tags: list[str]) -> None:
        task = self._session.get(Task, task_id)
        if task is None:
            return
        task.tags.clear()  # cascade delete-orphan drops the old rows
        self._session.flush()
        for tag in dict.fromkeys(tags):
            task.tags.append(TaskTag(tag=tag))
        self._session.flush()

    def reorder(self, bucket: str, task_ids: list[int]) -> None:
        position = {task_id: index for index, task_id in enumerate(task_ids)}
        tasks = (
            self._session.execute(select(Task).where(Task.bucket == bucket))
            .scalars()
            .all()
        )
        for task in tasks:
            if task.id in position:
                task.sort_order = position[task.id]
        self._session.flush()

    def delete_task(self, task_id: int) -> bool:
        # Soft delete: drop it from the todo lists but keep the row + its blocks
        # so pomo/todo history survives.
        task = self._get(task_id)
        if task is None:
            return False
        task.archived = True
        self._session.flush()
        return True

    def hard_delete_block(self, block_id: int) -> bool:
        block = self._session.get(Block, block_id)
        if block is None:
            return False
        self._session.delete(block)
        self._session.flush()
        return True

    def hard_delete_task(self, task_id: int) -> bool:
        # Permanent delete: removes the row, cascading to blocks + tags.
        task = self._get(task_id)
        if task is None:
            return False
        self._session.delete(task)
        self._session.flush()
        return True

    def delete_completed_tasks(self) -> int:
        tasks = (
            self._session.execute(
                select(Task).where(
                    Task.status == "done", Task.archived.is_(False)
                )
            )
            .scalars()
            .all()
        )
        for task in tasks:
            task.archived = True
        self._session.flush()
        return len(tasks)

    def get_all_tasks_with_stats(
        self, limit: int | None = None, offset: int = 0
    ) -> list[dict]:
        stmt = select(Task).order_by(Task.created_at.desc(), Task.id.desc())
        if limit is not None:
            stmt = stmt.limit(limit).offset(offset)
        tasks = self._session.execute(stmt).scalars().all()
        stats = self.get_task_block_stats()
        result = []
        for task in tasks:
            done = stats.get(task.id, {}).get("blocks_done", 0)
            result.append(
                {
                    "id": task.id,
                    "name": task.name,
                    "tags": [tag.tag for tag in task.tags],
                    "status": task.status,
                    "archived": task.archived,
                    "bucket": task.bucket,
                    "blocks_done": (
                        task.blocks_override
                        if task.blocks_override is not None
                        else done
                    ),
                    "created_at": _iso(task.created_at),
                }
            )
        return result

    def create_block(self, task_id: int | None, duration_min: int) -> dict:
        # Invariant: at most one open block. Starting a new focus closes any block
        # left running (a failed end, a second tab/device) so two pomos can never
        # be credited out of the same window. A leftover that already ran its full
        # duration is a finished pomo only awaiting credit — keep it (credit its
        # anchor) instead of aborting, so a finished pomo is never silently dropped.
        now = utcnow()
        for leftover in (
            self._session.query(Block).filter(Block.ended_at.is_(None)).all()
        ):
            leftover.ended_at = now
            # sqlite returns started_at tz-naive; treat stored times as UTC.
            started = leftover.started_at
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            elapsed = (now - started).total_seconds()
            leftover.completed = elapsed >= leftover.duration_min * 60
        block = Block(task_id=task_id, duration_min=duration_min)
        self._session.add(block)
        self._session.flush()
        return {
            "id": block.id,
            "task_id": block.task_id,
            "duration_min": block.duration_min,
            "started_at": _iso(block.started_at),
        }

    def get_block(self, block_id: int) -> dict | None:
        block = self._session.get(Block, block_id)
        if block is None:
            return None
        return {
            "id": block.id,
            "task_id": block.task_id,
            "duration_min": block.duration_min,
            "started_at": _iso(block.started_at),
            "ended_at": _iso(block.ended_at),
            "completed": block.completed,
        }

    def end_block(self, block_id: int, completed: bool) -> dict | None:
        block = self._session.get(Block, block_id)
        if block is None or block.ended_at is not None:
            return None
        block.ended_at = utcnow()
        block.completed = completed
        self._session.flush()
        return self.get_block(block_id)

    def set_block_tasks(
        self,
        block_id: int,
        active_task_id: int | None,
        touched_task_ids: list[int],
    ) -> dict | None:
        block = self._session.get(Block, block_id)
        if block is None or block.ended_at is not None:
            return None
        # task_id is the anchor — credit/dedup attributes the single pomo to it.
        # Set it only on the first assign (a taskless block); later switches just
        # grow the touched set, leaving the anchor put.
        if block.task_id is None and active_task_id is not None:
            block.task_id = active_task_id
        # Replace the touched set wholesale.
        self._session.query(BlockTouch).filter(
            BlockTouch.block_id == block_id
        ).delete()
        for task_id in dict.fromkeys(touched_task_ids):
            self._session.add(BlockTouch(block_id=block_id, task_id=task_id))
        self._session.flush()
        return self.get_block(block_id)

    def _block_touched_ids(self, block_id: int) -> list[int]:
        rows = self._session.execute(
            select(BlockTouch.task_id).where(BlockTouch.block_id == block_id)
        ).scalars()
        return sorted(rows)

    def credit_block(
        self, block_id: int, task_ids: list[int], note: str = ""
    ) -> int | None:
        block = self._session.get(Block, block_id)
        if block is None or block.ended_at is not None:
            return None
        now = utcnow()
        block.ended_at = now
        block.completed = True
        block.note = note
        if task_ids and block.task_id not in task_ids:
            block.task_id = task_ids[0]
        self._session.flush()
        return 1

    def get_running_block(self) -> dict | None:
        block = self._session.execute(
            select(Block)
            .where(Block.ended_at.is_(None))
            .order_by(Block.started_at.desc())
            .limit(1)
        ).scalar_one_or_none()
        if block is None:
            return None
        task_name = block.task.name if block.task_id is not None else ""
        return {
            "id": block.id,
            "task_id": block.task_id,
            "task_name": task_name,
            "duration_min": block.duration_min,
            "started_at": _iso(block.started_at),
            "touched_task_ids": self._block_touched_ids(block.id),
        }

    # ---- break state (singleton row id=1: the running break, no task) ----

    def set_break(self, mode: str, deadline_ms: int) -> None:
        row = self._session.get(BreakState, 1)
        if row is None:
            self._session.add(
                BreakState(id=1, mode=mode, deadline_ms=deadline_ms)
            )
        else:
            row.mode = mode
            row.deadline_ms = deadline_ms
        self._session.flush()

    def clear_break(self) -> None:
        row = self._session.get(BreakState, 1)
        if row is not None:
            self._session.delete(row)
            self._session.flush()

    def get_break(self) -> dict | None:
        row = self._session.get(BreakState, 1)
        if row is None:
            return None
        # Lazy-expire: a break whose deadline has passed is no longer running.
        if row.deadline_ms <= int(utcnow().timestamp() * 1000):
            self._session.delete(row)
            self._session.flush()
            return None
        return {"mode": row.mode, "deadline": row.deadline_ms}

    def get_task_block_stats(self) -> dict[int, dict]:
        rows = self._session.execute(
            select(
                Task.id,
                func.count(Block.id),
                func.coalesce(func.sum(Block.duration_min), 0),
                func.min(Block.started_at),
                func.max(Block.ended_at),
            )
            .outerjoin(
                Block,
                (Block.task_id == Task.id)
                & Block.completed.is_(True),
            )
            .group_by(Task.id)
        ).all()
        return {
            row[0]: {
                "blocks_done": row[1],
                "total_minutes": row[2],
                "started_at": _iso(row[3]),
                "ended_at": _iso(row[4]),
            }
            for row in rows
        }

    def get_tag_summaries(self) -> list[dict]:
        rows = self._session.execute(
            select(
                TaskTag.tag,
                func.count(Block.id),
                func.coalesce(func.sum(Block.duration_min), 0),
            )
            .join(Block, Block.task_id == TaskTag.task_id)
            .where(
                Block.completed.is_(True),
            )
            .group_by(TaskTag.tag)
            .order_by(TaskTag.tag)
        ).all()
        return [
            {"tag": row[0], "blocks": row[1], "total_minutes": row[2]}
            for row in rows
        ]

    def get_completed_blocks(self, since: datetime | None = None) -> list[dict]:
        conditions = [
            Block.completed.is_(True),
            Block.ended_at.is_not(None),
        ]
        if since is not None:
            conditions.append(Block.started_at >= since)
        blocks = (
            self._session.execute(
                select(Block)
                .where(*conditions)
                .order_by(Block.started_at)
            )
            .scalars()
            .all()
        )
        return [self._block_to_dict(block) for block in blocks]

    def _block_to_dict(self, block: Block) -> dict:
        if block.task_id is None:
            task_name = ""
            tags: list[str] = []
        else:
            task_name = block.task.name
            tags = [tag.tag for tag in block.task.tags]
        return {
            "id": block.id,
            "started_at": _iso(block.started_at),
            "ended_at": _iso(block.ended_at),
            "duration_min": block.duration_min,
            "task_id": block.task_id,
            "task_name": task_name,
            "tags": tags,
            "note": block.note,
        }

    def get_completed_blocks_page(self, limit: int, offset: int) -> list[dict]:
        blocks = (
            self._session.execute(
                select(Block)
                .where(
                    Block.completed.is_(True),
                    Block.ended_at.is_not(None),
                )
                .order_by(Block.started_at.desc(), Block.id.desc())
                .limit(limit)
                .offset(offset)
            )
            .scalars()
            .all()
        )
        return [self._block_to_dict(block) for block in blocks]

    def count_completed_blocks(self) -> int:
        return self._session.execute(
            select(func.count(Block.id))
            .where(
                Block.completed.is_(True),
                Block.ended_at.is_not(None),
            )
        ).scalar_one()

    def count_tasks(self, status: str | None = None) -> int:
        stmt = select(func.count(Task.id))
        if status is not None:
            stmt = stmt.where(Task.status == status)
        return self._session.execute(stmt).scalar_one()
