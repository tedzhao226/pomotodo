import sqlite3
from datetime import datetime, timezone


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Repository:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def _tags_for_task(self, task_id: int) -> list[str]:
        rows = self._conn.execute(
            "SELECT tag FROM task_tags WHERE task_id = ? ORDER BY tag",
            (task_id,),
        ).fetchall()
        return [row["tag"] for row in rows]

    def _task_row_to_dict(self, row: sqlite3.Row) -> dict:
        return {
            "id": row["id"],
            "name": row["name"],
            "estimate_blocks": row["estimate_blocks"],
            "blocks_override": row["blocks_override"],
            "status": row["status"],
            "created_at": row["created_at"],
            "tags": self._tags_for_task(row["id"]),
        }

    def create_task(
        self,
        name: str,
        estimate_blocks: int | None,
        tags: list[str],
    ) -> dict:
        created_at = utc_now_iso()
        cursor = self._conn.execute(
            """
            INSERT INTO tasks (name, estimate_blocks, status, created_at)
            VALUES (?, ?, 'active', ?)
            """,
            (name, estimate_blocks, created_at),
        )
        task_id = cursor.lastrowid
        for tag in tags:
            self._conn.execute(
                "INSERT INTO task_tags (task_id, tag) VALUES (?, ?)",
                (task_id, tag),
            )
        row = self._conn.execute(
            "SELECT * FROM tasks WHERE id = ?",
            (task_id,),
        ).fetchone()
        return self._task_row_to_dict(row)

    def list_tasks(self, tag: str | None = None) -> list[dict]:
        if tag:
            rows = self._conn.execute(
                """
                SELECT t.*
                FROM tasks t
                INNER JOIN task_tags tt ON t.id = tt.task_id
                WHERE tt.tag = ?
                ORDER BY t.created_at DESC
                """,
                (tag,),
            ).fetchall()
        else:
            rows = self._conn.execute(
                "SELECT * FROM tasks ORDER BY created_at DESC",
            ).fetchall()
        return [self._task_row_to_dict(row) for row in rows]

    def get_task(self, task_id: int) -> dict | None:
        row = self._conn.execute(
            "SELECT * FROM tasks WHERE id = ?",
            (task_id,),
        ).fetchone()
        if row is None:
            return None
        return self._task_row_to_dict(row)

    def update_task(self, task_id: int, fields: dict) -> dict | None:
        row = self._conn.execute(
            "SELECT id FROM tasks WHERE id = ?",
            (task_id,),
        ).fetchone()
        if row is None:
            return None
        if fields:
            assignments = ", ".join(f"{column} = ?" for column in fields)
            self._conn.execute(
                f"UPDATE tasks SET {assignments} WHERE id = ?",
                (*fields.values(), task_id),
            )
        return self.get_task(task_id)

    def delete_task(self, task_id: int) -> bool:
        row = self._conn.execute(
            "SELECT id FROM tasks WHERE id = ?",
            (task_id,),
        ).fetchone()
        if row is None:
            return False
        self._conn.execute("DELETE FROM blocks WHERE task_id = ?", (task_id,))
        self._conn.execute("DELETE FROM task_tags WHERE task_id = ?", (task_id,))
        self._conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        return True

    def delete_completed_tasks(self) -> int:
        ids = [
            row["id"]
            for row in self._conn.execute(
                "SELECT id FROM tasks WHERE status = 'done'"
            ).fetchall()
        ]
        for task_id in ids:
            self.delete_task(task_id)
        return len(ids)

    def create_block(self, task_id: int, duration_min: int) -> dict:
        started_at = utc_now_iso()
        cursor = self._conn.execute(
            """
            INSERT INTO blocks (task_id, duration_min, started_at, ended_at, completed)
            VALUES (?, ?, ?, NULL, 0)
            """,
            (task_id, duration_min, started_at),
        )
        block_id = cursor.lastrowid
        return {
            "id": block_id,
            "task_id": task_id,
            "duration_min": duration_min,
            "started_at": started_at,
        }

    def get_block(self, block_id: int) -> dict | None:
        row = self._conn.execute(
            "SELECT * FROM blocks WHERE id = ?",
            (block_id,),
        ).fetchone()
        if row is None:
            return None
        return {
            "id": row["id"],
            "task_id": row["task_id"],
            "duration_min": row["duration_min"],
            "started_at": row["started_at"],
            "ended_at": row["ended_at"],
            "completed": bool(row["completed"]),
        }

    def end_block(self, block_id: int, completed: bool) -> dict | None:
        row = self._conn.execute(
            "SELECT id FROM blocks WHERE id = ?",
            (block_id,),
        ).fetchone()
        if row is None:
            return None
        ended_at = utc_now_iso()
        self._conn.execute(
            """
            UPDATE blocks
            SET ended_at = ?, completed = ?
            WHERE id = ?
            """,
            (ended_at, int(completed), block_id),
        )
        return self.get_block(block_id)

    def get_running_block(self) -> dict | None:
        row = self._conn.execute(
            """
            SELECT b.*, t.name AS task_name
            FROM blocks b
            INNER JOIN tasks t ON t.id = b.task_id
            WHERE b.ended_at IS NULL
            ORDER BY b.started_at DESC
            LIMIT 1
            """
        ).fetchone()
        if row is None:
            return None
        return {
            "id": row["id"],
            "task_id": row["task_id"],
            "task_name": row["task_name"],
            "duration_min": row["duration_min"],
            "started_at": row["started_at"],
        }

    def get_task_block_stats(self) -> dict[int, dict[str, int]]:
        rows = self._conn.execute(
            """
            SELECT task_id,
                   COUNT(*) AS blocks_done,
                   COALESCE(SUM(duration_min), 0) AS total_minutes,
                   MIN(started_at) AS started_at,
                   MAX(ended_at) AS ended_at
            FROM blocks
            WHERE ended_at IS NOT NULL
            GROUP BY task_id
            """
        ).fetchall()
        return {
            row["task_id"]: {
                "blocks_done": row["blocks_done"],
                "total_minutes": row["total_minutes"],
                "started_at": row["started_at"],
                "ended_at": row["ended_at"],
            }
            for row in rows
        }

    def get_tag_summaries(self) -> list[dict]:
        rows = self._conn.execute(
            """
            SELECT tt.tag,
                   COUNT(b.id) AS blocks,
                   COALESCE(SUM(b.duration_min), 0) AS total_minutes
            FROM task_tags tt
            INNER JOIN blocks b ON b.task_id = tt.task_id AND b.ended_at IS NOT NULL
            GROUP BY tt.tag
            ORDER BY tt.tag
            """
        ).fetchall()
        return [
            {
                "tag": row["tag"],
                "blocks": row["blocks"],
                "total_minutes": row["total_minutes"],
            }
            for row in rows
        ]

    def get_completed_blocks(self, since_iso: str) -> list[dict]:
        rows = self._conn.execute(
            """
            SELECT b.started_at, b.ended_at, b.duration_min,
                   b.task_id, t.name AS task_name
            FROM blocks b
            INNER JOIN tasks t ON t.id = b.task_id
            WHERE b.completed = 1
              AND b.ended_at IS NOT NULL
              AND b.started_at >= ?
            ORDER BY b.started_at
            """,
            (since_iso,),
        ).fetchall()
        tags_cache: dict[int, list[str]] = {}
        blocks = []
        for row in rows:
            task_id = row["task_id"]
            if task_id not in tags_cache:
                tags_cache[task_id] = self._tags_for_task(task_id)
            blocks.append(
                {
                    "started_at": row["started_at"],
                    "ended_at": row["ended_at"],
                    "duration_min": row["duration_min"],
                    "task_id": task_id,
                    "task_name": row["task_name"],
                    "tags": tags_cache[task_id],
                }
            )
        return blocks

    def count_completed_blocks(self) -> int:
        row = self._conn.execute(
            "SELECT COUNT(*) AS n FROM blocks WHERE completed = 1 AND ended_at IS NOT NULL"
        ).fetchone()
        return row["n"]

    def count_tasks(self, status: str | None = None) -> int:
        if status is None:
            row = self._conn.execute("SELECT COUNT(*) AS n FROM tasks").fetchone()
        else:
            row = self._conn.execute(
                "SELECT COUNT(*) AS n FROM tasks WHERE status = ?",
                (status,),
            ).fetchone()
        return row["n"]
