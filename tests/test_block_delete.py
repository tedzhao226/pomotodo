import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from backend.api import get_db
from backend.errors import NotFoundError
from backend.main import app
from backend.models import Base, Block
from backend.repository import Repository
from backend.service import Service


@pytest.fixture
def session():
    engine = create_engine("sqlite://", future=True)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    db = factory()
    yield db
    db.close()


@pytest.fixture
def repository(session):
    return Repository(session)


@pytest.fixture
def service(repository):
    return Service(repository)


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
def app_transport():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)

    def override_get_db():
        db = factory()
        try:
            yield db
            db.commit()
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield httpx.ASGITransport(app=app)
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)
        engine.dispose()


def test_pomo_soft_delete_excludes_history_and_keeps_block_row(service, session):
    task = service.create_task_from_raw("focus")
    block = service.start_block(task["id"], 25)
    service.credit_block(block["id"], [task["id"]], "done")

    service.delete_block(block["id"])

    assert service.get_history()["pomos"] == []
    archived = session.get(Block, block["id"])
    assert archived is not None
    assert archived.archived is True


@pytest.mark.anyio
async def test_pomo_soft_delete_http_delete_returns_204_and_archives(
    app_transport,
):
    async with httpx.AsyncClient(
        transport=app_transport,
        base_url="http://test",
    ) as client:
        task_response = await client.post("/api/tasks", json={"raw": "focus"})
        task = task_response.json()
        block_response = await client.post(
            f"/api/tasks/{task['id']}/blocks",
            json={"duration_min": 25},
        )
        block = block_response.json()
        await client.post(
            f"/api/blocks/{block['id']}/credit",
            json={"task_ids": [task["id"]], "note": "done"},
        )

        response = await client.delete(f"/api/blocks/{block['id']}")

        history = await client.get("/api/history")
        assert response.status_code == 204
        assert history.json()["pomos"] == []


def test_pomo_stats_exclude_soft_deleted_block(service, repository):
    task = service.create_task_from_raw("focus #work")
    block = service.start_block(task["id"], 25)
    service.credit_block(block["id"], [task["id"]], "done")

    service.delete_block(block["id"])

    assert repository.count_completed_blocks() == 0
    assert repository.get_task_block_stats()[task["id"]]["blocks_done"] == 0
    assert repository.get_tag_summaries() == []


def test_todo_keeps_completed_pomos_in_history_and_stats(service):
    task = service.create_task_from_raw("focus #work")
    block = service.start_block(task["id"], 25)
    service.credit_block(block["id"], [task["id"]], "done")

    service.delete_task(task["id"])

    history = service.get_history()
    assert len(history["pomos"]) == 1
    assert service.get_stats()["all_time_pomos"] == 1
    todo = next(t for t in history["todos"] if t["id"] == task["id"])
    assert todo["archived"] is True
    assert todo["blocks_done"] == 1


def test_delete_block_missing_id_raises_not_found(service):
    with pytest.raises(NotFoundError):
        service.delete_block(9999)
