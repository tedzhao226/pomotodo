from typing import Literal

from pydantic import BaseModel, Field


class CreateTaskRequest(BaseModel):
    raw: str


class TaskResponse(BaseModel):
    id: int
    name: str
    tags: list[str]
    estimate_blocks: int | None
    status: str
    bucket: str
    sort_order: int
    note: str
    created_at: str


class UpdateTaskRequest(BaseModel):
    name: str | None = None
    estimate_blocks: int | None = None
    blocks_done: int | None = None
    status: Literal["active", "done"] | None = None
    bucket: Literal["today", "backlog"] | None = None
    note: str | None = None


class ReorderRequest(BaseModel):
    bucket: Literal["today", "backlog"]
    task_ids: list[int]


class CreateBlockRequest(BaseModel):
    duration_min: int


class BlockStartResponse(BaseModel):
    id: int
    task_id: int
    duration_min: int
    started_at: str


class EndBlockRequest(BaseModel):
    completed: bool


class CreditBlockRequest(BaseModel):
    task_ids: list[int]


class BlockResponse(BaseModel):
    id: int
    task_id: int
    duration_min: int
    started_at: str
    ended_at: str | None
    completed: bool


class DashboardTask(BaseModel):
    id: int
    name: str
    tags: list[str]
    estimate_blocks: int | None
    status: str
    bucket: str
    sort_order: int
    note: str
    blocks_done: int
    total_minutes: int
    started_at: str | None = None
    ended_at: str | None = None


class RunningBlock(BaseModel):
    id: int
    task_id: int
    task_name: str
    duration_min: int
    started_at: str


class TagSummary(BaseModel):
    tag: str
    total_minutes: int
    blocks: int


class DashboardResponse(BaseModel):
    tasks: list[DashboardTask]
    running_block: RunningBlock | None = None
    tags: list[TagSummary] = Field(default_factory=list)


class StatsBlock(BaseModel):
    started_at: str
    ended_at: str | None
    duration_min: int
    task_id: int
    task_name: str
    tags: list[str]


class StatsResponse(BaseModel):
    blocks: list[StatsBlock]
    all_time_pomos: int
    all_time_todos: int
    done_todos: int
    tags: list[TagSummary] = Field(default_factory=list)


class HistoryTodo(BaseModel):
    id: int
    name: str
    tags: list[str]
    status: str
    archived: bool
    bucket: str
    blocks_done: int
    created_at: str


class HistoryResponse(BaseModel):
    pomos: list[StatsBlock]
    pomos_total: int
    todos: list[HistoryTodo]
    todos_total: int
