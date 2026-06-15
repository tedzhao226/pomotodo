from datetime import timedelta

from sqlalchemy.orm import Session

from backend.db import get_engine
from backend.models import Block, Task, TaskTag, utcnow


def main() -> None:
    with Session(get_engine()) as s:
        if s.query(Task).first() is not None:
            print("seed: tasks already present, skipping")
            return

        now = utcnow()
        tasks = [
            Task(
                name="Draft product spec",
                estimate_blocks=3,
                bucket="today",
                sort_order=0,
                note="Outline acceptance criteria before writing implementation notes.",
                tags=[TaskTag(tag="work"), TaskTag(tag="writing")],
            ),
            Task(
                name="Review pull request",
                estimate_blocks=1,
                bucket="today",
                sort_order=1,
                tags=[TaskTag(tag="work")],
            ),
            Task(
                name="Study SQLAlchemy sessions",
                estimate_blocks=2,
                bucket="today",
                sort_order=2,
                tags=[TaskTag(tag="study"), TaskTag(tag="backend")],
            ),
            Task(
                name="Plan newsletter outline",
                estimate_blocks=2,
                bucket="backlog",
                sort_order=0,
                tags=[TaskTag(tag="writing")],
            ),
            Task(
                name="Refine dashboard sketch",
                estimate_blocks=4,
                bucket="backlog",
                sort_order=1,
                tags=[TaskTag(tag="work"), TaskTag(tag="design")],
            ),
            Task(
                name="Archive weekly notes",
                estimate_blocks=1,
                status="done",
                bucket="today",
                sort_order=3,
                tags=[TaskTag(tag="admin")],
            ),
        ]

        block_specs = [
            (tasks[0], 25, 6),
            (tasks[0], 25, 5),
            (tasks[0], 30, 4),
            (tasks[1], 25, 3),
            (tasks[1], 30, 2),
        ]
        blocks = []
        for task, duration_min, hours_ago in block_specs:
            started_at = now - timedelta(hours=hours_ago)
            blocks.append(
                Block(
                    task=task,
                    duration_min=duration_min,
                    completed=True,
                    started_at=started_at,
                    ended_at=started_at + timedelta(minutes=duration_min),
                )
            )

        s.add_all(tasks)
        s.add_all(blocks)
        s.commit()
        print(f"seed: inserted {len(tasks)} tasks, {len(blocks)} blocks")


if __name__ == "__main__":
    main()
