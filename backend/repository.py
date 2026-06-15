from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.models import Block, Task, TaskTag, utcnow


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
        # A bucket change re-homes the task at the end of the target bucket so it
        # doesn't collide with an existing sort_order.
        if "bucket" in fields and fields["bucket"] != task.bucket:
            task.sort_order = self._next_sort_order(fields["bucket"])
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

    def create_block(self, task_id: int, duration_min: int) -> dict:
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
        if block is None:
            return None
        block.ended_at = utcnow()
        block.completed = completed
        self._session.flush()
        return self.get_block(block_id)

    def credit_block(self, block_id: int, task_ids: list[int]) -> int | None:
        # Close the open block and credit a completed block to each task that
        # was touched during it. The block's own task reuses the block row;
        # the rest get fresh completed rows of the same length.
        block = self._session.get(Block, block_id)
        if block is None:
            return None
        now = utcnow()
        block.ended_at = now
        block.completed = block.task_id in task_ids
        extra = [tid for tid in task_ids if tid != block.task_id]
        for tid in extra:
            self._session.add(
                Block(
                    task_id=tid,
                    duration_min=block.duration_min,
                    started_at=now,
                    ended_at=now,
                    completed=True,
                )
            )
        self._session.flush()
        return (1 if block.completed else 0) + len(extra)

    def get_running_block(self) -> dict | None:
        block = self._session.execute(
            select(Block)
            .where(Block.ended_at.is_(None))
            .order_by(Block.started_at.desc())
            .limit(1)
        ).scalar_one_or_none()
        if block is None:
            return None
        return {
            "id": block.id,
            "task_id": block.task_id,
            "task_name": block.task.name,
            "duration_min": block.duration_min,
            "started_at": _iso(block.started_at),
        }

    def get_task_block_stats(self) -> dict[int, dict]:
        rows = self._session.execute(
            select(
                Block.task_id,
                func.count(Block.id),
                func.coalesce(func.sum(Block.duration_min), 0),
                func.min(Block.started_at),
                func.max(Block.ended_at),
            )
            .where(Block.completed.is_(True))
            .group_by(Block.task_id)
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
            .where(Block.completed.is_(True))
            .group_by(TaskTag.tag)
            .order_by(TaskTag.tag)
        ).all()
        return [
            {"tag": row[0], "blocks": row[1], "total_minutes": row[2]}
            for row in rows
        ]

    def get_completed_blocks(self, since: datetime | None = None) -> list[dict]:
        conditions = [Block.completed.is_(True), Block.ended_at.is_not(None)]
        if since is not None:
            conditions.append(Block.started_at >= since)
        blocks = (
            self._session.execute(
                select(Block).where(*conditions).order_by(Block.started_at)
            )
            .scalars()
            .all()
        )
        return [self._block_to_dict(block) for block in blocks]

    def _block_to_dict(self, block: Block) -> dict:
        return {
            "started_at": _iso(block.started_at),
            "ended_at": _iso(block.ended_at),
            "duration_min": block.duration_min,
            "task_id": block.task_id,
            "task_name": block.task.name,
            "tags": [tag.tag for tag in block.task.tags],
        }

    def get_completed_blocks_page(self, limit: int, offset: int) -> list[dict]:
        blocks = (
            self._session.execute(
                select(Block)
                .where(Block.completed.is_(True), Block.ended_at.is_not(None))
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
            select(func.count(Block.id)).where(
                Block.completed.is_(True), Block.ended_at.is_not(None)
            )
        ).scalar_one()

    def count_tasks(self, status: str | None = None) -> int:
        stmt = select(func.count(Task.id))
        if status is not None:
            stmt = stmt.where(Task.status == status)
        return self._session.execute(stmt).scalar_one()
