import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "pomotodo.db"


def get_connection() -> sqlite3.Connection:
    # check_same_thread=False: FastAPI runs sync endpoints and the get_db
    # generator in threadpool workers, so a per-request connection may be
    # opened and closed on different threads. The connection is never shared
    # between requests, so disabling the same-thread guard is safe here.
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_schema() -> None:
    conn = get_connection()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                estimate_blocks INTEGER,
                blocks_override INTEGER,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS task_tags (
                task_id INTEGER NOT NULL REFERENCES tasks(id),
                tag TEXT NOT NULL,
                PRIMARY KEY (task_id, tag)
            );

            CREATE TABLE IF NOT EXISTS blocks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL REFERENCES tasks(id),
                duration_min INTEGER NOT NULL,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                completed INTEGER NOT NULL DEFAULT 0
            );
            """
        )
        columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(tasks)").fetchall()
        }
        if "blocks_override" not in columns:
            conn.execute("ALTER TABLE tasks ADD COLUMN blocks_override INTEGER")
        conn.commit()
    finally:
        conn.close()
