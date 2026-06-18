import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import Base
from backend.repository import Repository
from backend.service import NotFoundError, Service


@pytest.fixture
def service():
    engine = create_engine("sqlite://", future=True)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    svc = Service(Repository(db))
    yield svc
    db.close()


def _ids(service):
    a = service.create_task_from_raw("A")["id"]
    b = service.create_task_from_raw("B")["id"]
    c = service.create_task_from_raw("C")["id"]
    return a, b, c


def test_touched_set_persists_across_switches(service):
    a, b, c = _ids(service)
    block = service.start_block(a, 25)

    # touch A, then switch to B, then C — the touched set accumulates; the anchor
    # (the start task A) stays put.
    service.set_block_tasks(block["id"], a, [a])
    service.set_block_tasks(block["id"], b, [a, b])
    service.set_block_tasks(block["id"], c, [a, b, c])

    running = service.get_dashboard()["running_block"]
    assert running["task_id"] == a  # anchor unchanged by switches
    assert running["touched_task_ids"] == [a, b, c]


def test_chip_remove_persists(service):
    a, b, c = _ids(service)
    block = service.start_block(a, 25)
    service.set_block_tasks(block["id"], c, [a, b, c])

    # remove B from the touched set
    service.set_block_tasks(block["id"], c, [a, c])
    running = service.get_dashboard()["running_block"]
    assert running["touched_task_ids"] == [a, c]


def test_set_block_tasks_unknown_task_raises(service):
    a, _, _ = _ids(service)
    block = service.start_block(a, 25)
    with pytest.raises(NotFoundError):
        service.set_block_tasks(block["id"], a, [a, 9999])


def test_set_block_tasks_missing_block_raises(service):
    a, _, _ = _ids(service)
    with pytest.raises(NotFoundError):
        service.set_block_tasks(999999, a, [a])
