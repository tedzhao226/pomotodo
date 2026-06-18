import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import Base
from backend.repository import Repository
from backend.service import Service


@pytest.fixture
def service():
    engine = create_engine("sqlite://", future=True)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    svc = Service(Repository(db))
    yield svc
    db.close()


def test_unanchored_start_and_credit(service):
    task = service.create_task_from_raw("ship feature")
    block = service.start_unanchored_block(25)
    assert block["task_id"] is None

    dashboard = service.get_dashboard()
    assert dashboard["running_block"] is not None
    assert dashboard["running_block"]["task_id"] is None
    assert dashboard["running_block"]["task_name"] == ""

    credited = service.credit_block(block["id"], [task["id"]], note="shipped it")
    assert credited == 1

    dashboard = service.get_dashboard()
    assert dashboard["running_block"] is None
    task_row = next(t for t in dashboard["tasks"] if t["id"] == task["id"])
    assert task_row["blocks_done"] == 1

    history = service.get_history(
        pomos_limit=10, pomos_offset=0, todos_limit=10, todos_offset=0
    )
    assert any(
        p["task_id"] == task["id"] and p["note"] == "shipped it"
        for p in history["pomos"]
    )


def test_assign_persists_anchor_on_taskless_block(service):
    task = service.create_task_from_raw("write tests")
    block = service.start_unanchored_block(25)
    assert block["task_id"] is None

    assigned = service.set_block_tasks(block["id"], task["id"], [task["id"]])
    assert assigned["task_id"] == task["id"]

    # A reload reads the running block from the dashboard — anchor must survive.
    running = service.get_dashboard()["running_block"]
    assert running["task_id"] == task["id"]
    assert running["task_name"] == "write tests"
    assert running["touched_task_ids"] == [task["id"]]


def test_assign_unknown_task_raises(service):
    from backend.service import NotFoundError

    block = service.start_unanchored_block(25)
    with pytest.raises(NotFoundError):
        service.set_block_tasks(block["id"], 9999, [9999])


def test_stats_response_accepts_taskless_block(service):
    # A completed taskless block (task_id=None) must not break /api/stats.
    # Regression: StatsBlock.task_id was typed `int`, so StatsResponse rejected
    # None and the endpoint 500'd once any taskless block existed.
    from backend.schemas import StatsResponse

    block = service.start_unanchored_block(25)
    service.credit_block(block["id"], [], note="")  # complete, still task_id=None

    stats = service.get_stats()
    response = StatsResponse(**stats)  # mirrors backend/api.py get_stats
    assert any(b.task_id is None for b in response.blocks)


def test_credit_empty_task_ids_completes_block(service):
    block = service.start_unanchored_block(25)
    credited = service.credit_block(block["id"], [], note="")
    assert credited == 1
    dashboard = service.get_dashboard()
    assert dashboard["running_block"] is None
