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


def test_credit_note_lands_on_finished_pomo_when_anchor_uncredited(service):
    # The block was started on A but, after a mid-block switch, only B is
    # credited. The record must ride the finished pomo (B), not the abandoned
    # anchor (A) which stays incomplete and never reaches history.
    a = service.create_task_from_raw("task A")
    b = service.create_task_from_raw("task B")
    block = service.start_block(a["id"], 25)
    service.credit_block(block["id"], [b["id"]], "switched to B")

    pomos = service.get_history()["pomos"]
    assert [p["task_name"] for p in pomos] == ["task B"]
    assert pomos[0]["note"] == "switched to B"


def test_credit_note_on_every_credited_pomo(service):
    # Crediting several touched tasks produces one finished pomo each; the
    # session record shows on all of them.
    a = service.create_task_from_raw("task A")
    b = service.create_task_from_raw("task B")
    block = service.start_block(a["id"], 25)
    service.credit_block(block["id"], [a["id"], b["id"]], "A + B")

    pomos = service.get_history()["pomos"]
    assert {p["task_name"] for p in pomos} == {"task A", "task B"}
    assert all(p["note"] == "A + B" for p in pomos)
