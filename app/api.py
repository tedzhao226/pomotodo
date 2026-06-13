import sqlite3
from collections.abc import Generator
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.db import get_connection
from app.repository import Repository
from app.schemas import (
    BlockResponse,
    BlockStartResponse,
    CreateBlockRequest,
    CreateTaskRequest,
    DashboardResponse,
    EndBlockRequest,
    StatsResponse,
    TaskResponse,
    UpdateTaskRequest,
)
from app.service import Service

router = APIRouter(prefix="/api")


def get_db() -> Generator[sqlite3.Connection, None, None]:
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def get_repository(
    conn: Annotated[sqlite3.Connection, Depends(get_db)],
) -> Repository:
    return Repository(conn)


def get_service(
    repository: Annotated[Repository, Depends(get_repository)],
) -> Service:
    return Service(repository)


@router.post("/tasks", response_model=TaskResponse)
def create_task(
    body: CreateTaskRequest,
    service: Annotated[Service, Depends(get_service)],
) -> TaskResponse:
    try:
        task = service.create_task_from_raw(body.raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return TaskResponse(**task)


@router.get("/tasks", response_model=list[TaskResponse])
def list_tasks(
    service: Annotated[Service, Depends(get_service)],
    tag: str | None = Query(default=None),
) -> list[TaskResponse]:
    tasks = service.list_tasks(tag)
    return [TaskResponse(**task) for task in tasks]


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    body: UpdateTaskRequest,
    service: Annotated[Service, Depends(get_service)],
) -> TaskResponse:
    try:
        task = service.update_task(
            task_id,
            name=body.name,
            estimate_blocks=body.estimate_blocks,
            blocks_done=body.blocks_done,
            status=body.status,
        )
    except ValueError as exc:
        detail = str(exc)
        code = 404 if "not found" in detail else 400
        raise HTTPException(status_code=code, detail=detail) from exc
    return TaskResponse(**task)


@router.post("/tasks/clear-completed")
def clear_completed_tasks(
    service: Annotated[Service, Depends(get_service)],
) -> dict[str, int]:
    return {"deleted": service.clear_completed_tasks()}


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    service: Annotated[Service, Depends(get_service)],
) -> None:
    try:
        service.delete_task(task_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/tasks/{task_id}/blocks", response_model=BlockStartResponse)
def start_block(
    task_id: int,
    body: CreateBlockRequest,
    service: Annotated[Service, Depends(get_service)],
) -> BlockStartResponse:
    try:
        block = service.start_block(task_id, body.duration_min)
    except ValueError as exc:
        detail = str(exc)
        status = 404 if "not found" in detail else 400
        raise HTTPException(status_code=status, detail=detail) from exc
    return BlockStartResponse(**block)


@router.patch("/blocks/{block_id}", response_model=BlockResponse)
def end_block(
    block_id: int,
    body: EndBlockRequest,
    service: Annotated[Service, Depends(get_service)],
) -> BlockResponse:
    try:
        block = service.end_block(block_id, body.completed)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return BlockResponse(**block)


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(
    service: Annotated[Service, Depends(get_service)],
) -> DashboardResponse:
    return DashboardResponse(**service.get_dashboard())


@router.get("/stats", response_model=StatsResponse)
def get_stats(
    service: Annotated[Service, Depends(get_service)],
) -> StatsResponse:
    return StatsResponse(**service.get_stats())
