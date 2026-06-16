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
    db = sessionmaker(bind=engine, expire_on_commit=False)()
    yield Service(Repository(db))
    db.close()


def _credited_note(service, name, note):
    task = service.create_task_from_raw(name)
    block = service.start_block(task["id"], 25)
    service.credit_block(block["id"], [task["id"]], note)
    pomo = next(
        p for p in service.get_history()["pomos"] if p["task_name"] == name
    )
    return pomo["note"]


def test_credit_saves_note(service):
    # VAL-REC-004: the record persists on the credited block and history shows it.
    assert _credited_note(service, "shipped", "shipped the thing") == "shipped the thing"
    # VAL-REC-006: no note -> defaults to "" (history falls back to the task name).
    assert _credited_note(service, "quiet", "") == ""
