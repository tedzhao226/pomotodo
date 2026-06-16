import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

from backend.errors import NotFoundError
from backend.models import Base, Block, TaskTag
from backend.repository import Repository
from backend.service import Service


@pytest.fixture
def ctx():
    engine = create_engine("sqlite://", future=True)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine, expire_on_commit=False)()
    yield Service(Repository(db)), db
    db.close()


def _credited_task(service, raw):
    # Create a task and finish one pomo on it, so it shows in both histories.
    task = service.create_task_from_raw(raw)
    block = service.start_block(task["id"], 25)
    service.credit_block(block["id"], [task["id"]], "done")
    return task


def test_delete_pomo_removes_block(ctx):
    # VAL-HD-001: permanently deleting a pomo drops the block row + the total.
    service, db = ctx
    _credited_task(service, "ship it #work")
    pomos = service.get_history()["pomos"]
    assert len(pomos) == 1
    before = service.get_history()["pomos_total"]

    service.hard_delete_block(pomos[0]["id"])

    assert service.get_history()["pomos_total"] == before - 1
    assert db.execute(select(func.count(Block.id))).scalar_one() == 0


def test_delete_todo_cascades(ctx):
    # VAL-HD-002: deleting a todo removes its task row, blocks and tags.
    service, db = ctx
    task = _credited_task(service, "ship it #work")
    assert db.execute(select(func.count(Block.id))).scalar_one() == 1
    assert db.execute(select(func.count(TaskTag.task_id))).scalar_one() == 1

    service.hard_delete_todo(task["id"])

    history = service.get_history()
    assert history["todos_total"] == 0
    assert history["pomos_total"] == 0
    assert db.execute(select(func.count(Block.id))).scalar_one() == 0
    assert db.execute(select(func.count(TaskTag.task_id))).scalar_one() == 0


def test_delete_missing_404(ctx):
    # VAL-HD-003: both permanent deletes raise NotFound for an unknown id.
    service, _ = ctx
    with pytest.raises(NotFoundError):
        service.hard_delete_block(999)
    with pytest.raises(NotFoundError):
        service.hard_delete_todo(999)
