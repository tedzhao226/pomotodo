from collections.abc import Generator
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.db import get_session
from backend.errors import NotFoundError, ValidationError
from backend.repository import Repository
from backend.schemas import (
    BlockResponse,
    BlockStartResponse,
    CreateBlockRequest,
    CreditBlockRequest,
    CreateTaskRequest,
    DashboardResponse,
    EndBlockRequest,
    HistoryResponse,
    ReorderRequest,
    StatsResponse,
    TaskResponse,
    UpdateTaskRequest,
)
from backend.service import Service

router = APIRouter(prefix="/api")


def get_db() -> Generator[Session, None, None]:
    yield from get_session()


def get_repository(
    session: Annotated[Session, Depends(get_db)],
) -> Repository:
    return Repository(session)


def get_service(
    repository: Annotated[Repository, Depends(get_repository)],
) -> Service:
    return Service(repository)


ServiceDep = Annotated[Service, Depends(get_service)]


@router.post("/tasks", response_model=TaskResponse)
def create_task(body: CreateTaskRequest, service: ServiceDep) -> TaskResponse:
    try:
        task = service.create_task_from_raw(body.raw)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return TaskResponse(**task)


@router.get("/tasks", response_model=list[TaskResponse])
def list_tasks(
    service: ServiceDep,
    tag: str | None = Query(default=None),
) -> list[TaskResponse]:
    return [TaskResponse(**task) for task in service.list_tasks(tag)]


@router.patch("/tasks/order")
def reorder_tasks(body: ReorderRequest, service: ServiceDep) -> dict[str, bool]:
    try:
        service.reorder_tasks(body.bucket, body.task_ids)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    body: UpdateTaskRequest,
    service: ServiceDep,
) -> TaskResponse:
    try:
        task = service.update_task(
            task_id,
            name=body.name,
            estimate_blocks=body.estimate_blocks,
            blocks_done=body.blocks_done,
            status=body.status,
            bucket=body.bucket,
            note=body.note,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return TaskResponse(**task)


@router.post("/tasks/clear-completed")
def clear_completed_tasks(service: ServiceDep) -> dict[str, int]:
    return {"deleted": service.clear_completed_tasks()}


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, service: ServiceDep) -> None:
    try:
        service.delete_task(task_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/tasks/{task_id}/blocks", response_model=BlockStartResponse)
def start_block(
    task_id: int,
    body: CreateBlockRequest,
    service: ServiceDep,
) -> BlockStartResponse:
    try:
        block = service.start_block(task_id, body.duration_min)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return BlockStartResponse(**block)


@router.patch("/blocks/{block_id}", response_model=BlockResponse)
def end_block(
    block_id: int,
    body: EndBlockRequest,
    service: ServiceDep,
) -> BlockResponse:
    try:
        block = service.end_block(block_id, body.completed)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return BlockResponse(**block)


@router.post("/blocks/{block_id}/credit")
def credit_block(
    block_id: int,
    body: CreditBlockRequest,
    service: ServiceDep,
) -> dict:
    try:
        credited = service.credit_block(block_id, body.task_ids)
    except NotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"credited": credited}


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(service: ServiceDep) -> DashboardResponse:
    return DashboardResponse(**service.get_dashboard())


@router.get("/stats", response_model=StatsResponse)
def get_stats(service: ServiceDep) -> StatsResponse:
    return StatsResponse(**service.get_stats())


@router.get("/history", response_model=HistoryResponse)
def get_history(
    service: ServiceDep,
    pomos_offset: int = Query(default=0, ge=0),
    pomos_limit: int = Query(default=20, ge=1, le=200),
    todos_offset: int = Query(default=0, ge=0),
    todos_limit: int = Query(default=20, ge=1, le=200),
) -> HistoryResponse:
    return HistoryResponse(
        **service.get_history(
            pomos_offset=pomos_offset,
            pomos_limit=pomos_limit,
            todos_offset=todos_offset,
            todos_limit=todos_limit,
        )
    )
