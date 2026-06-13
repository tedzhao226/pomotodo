from datetime import datetime, timedelta, timezone

from app.parser import parse_raw
from app.repository import Repository

VALID_DURATIONS = {30, 45, 60, 90}
STATS_WINDOW_DAYS = 90


class Service:
    def __init__(self, repository: Repository) -> None:
        self._repo = repository

    def create_task_from_raw(self, raw: str) -> dict:
        name, tags, estimate = parse_raw(raw)
        return self._repo.create_task(name, estimate, tags)

    def list_tasks(self, tag: str | None = None) -> list[dict]:
        return self._repo.list_tasks(tag)

    def update_task(
        self,
        task_id: int,
        *,
        name: str | None = None,
        estimate_blocks: int | None = None,
        blocks_done: int | None = None,
        status: str | None = None,
    ) -> dict:
        fields: dict = {}
        if name is not None:
            name = name.strip()
            if not name:
                raise ValueError("Task name cannot be empty")
            fields["name"] = name
        if estimate_blocks is not None:
            if estimate_blocks < 0:
                raise ValueError("estimate_blocks must be non-negative")
            fields["estimate_blocks"] = estimate_blocks
        if blocks_done is not None:
            if blocks_done < 0:
                raise ValueError("blocks_done must be non-negative")
            fields["blocks_override"] = blocks_done
        if status is not None:
            fields["status"] = status
        task = self._repo.update_task(task_id, fields)
        if task is None:
            raise ValueError(f"Task {task_id} not found")
        return task

    def delete_task(self, task_id: int) -> None:
        if not self._repo.delete_task(task_id):
            raise ValueError(f"Task {task_id} not found")

    def clear_completed_tasks(self) -> int:
        return self._repo.delete_completed_tasks()

    def start_block(self, task_id: int, duration_min: int) -> dict:
        if duration_min not in VALID_DURATIONS:
            raise ValueError(
                f"duration_min must be one of {sorted(VALID_DURATIONS)}"
            )
        task = self._repo.get_task(task_id)
        if task is None:
            raise ValueError(f"Task {task_id} not found")
        return self._repo.create_block(task_id, duration_min)

    def end_block(self, block_id: int, completed: bool) -> dict:
        block = self._repo.end_block(block_id, completed)
        if block is None:
            raise ValueError(f"Block {block_id} not found")
        return block

    def get_dashboard(self) -> dict:
        tasks = self._repo.list_tasks()
        stats = self._repo.get_task_block_stats()
        dashboard_tasks = []
        for task in tasks:
            task_stats = stats.get(
                task["id"],
                {
                    "blocks_done": 0,
                    "total_minutes": 0,
                    "started_at": None,
                    "ended_at": None,
                },
            )
            override = task["blocks_override"]
            blocks_done = override if override is not None else task_stats["blocks_done"]
            dashboard_tasks.append(
                {
                    "id": task["id"],
                    "name": task["name"],
                    "tags": task["tags"],
                    "estimate_blocks": task["estimate_blocks"],
                    "status": task["status"],
                    "blocks_done": blocks_done,
                    "total_minutes": task_stats["total_minutes"],
                    "started_at": task_stats["started_at"],
                    "ended_at": task_stats["ended_at"],
                }
            )
        return {
            "tasks": dashboard_tasks,
            "running_block": self._repo.get_running_block(),
            "tags": self._repo.get_tag_summaries(),
        }

    def get_stats(self) -> dict:
        since = datetime.now(timezone.utc) - timedelta(days=STATS_WINDOW_DAYS)
        return {
            "blocks": self._repo.get_completed_blocks(since.isoformat()),
            "all_time_pomos": self._repo.count_completed_blocks(),
            "all_time_todos": self._repo.count_tasks(),
            "done_todos": self._repo.count_tasks("done"),
            "tags": self._repo.get_tag_summaries(),
        }
