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
    a = service.create_task_from_raw("task A")
    b = service.create_task_from_raw("task B")
    block = service.start_block(a["id"], 25)
    service.credit_block(block["id"], [a["id"], b["id"]], "A + B")

    pomos = service.get_history()["pomos"]
    assert len(pomos) == 1
    assert pomos[0]["task_name"] == "task A"
    assert pomos[0]["note"] == "A + B"


def test_credit_block_dedup_records_one_pomo_with_note(service):
    a = service.create_task_from_raw("task A")
    b = service.create_task_from_raw("task B")
    block = service.start_block(a["id"], 25)

    credited = service.credit_block(block["id"], [a["id"], b["id"]], "A + B")

    pomos = service.get_history()["pomos"]
    assert credited == 1
    assert len(pomos) == 1
    assert service.get_stats()["all_time_pomos"] == 1
    assert pomos[0]["task_name"] == "task A"
    assert pomos[0]["note"] == "A + B"


def test_credit_block_attribution_repoints_to_first_checked_task(service):
    a = service.create_task_from_raw("task A")
    b = service.create_task_from_raw("task B")
    block = service.start_block(a["id"], 25)

    service.credit_block(block["id"], [b["id"]], "B only")

    pomos = service.get_history()["pomos"]
    assert len(pomos) == 1
    assert pomos[0]["task_id"] == b["id"]
    assert pomos[0]["task_name"] == "task B"
    assert "task A" not in {p["task_name"] for p in pomos}


def test_credit_block_count_counts_real_sessions(service):
    a = service.create_task_from_raw("task A")
    b = service.create_task_from_raw("task B")
    first = service.start_block(a["id"], 25)
    second = service.start_block(b["id"], 25)

    service.credit_block(first["id"], [a["id"], b["id"]], "A + B")
    service.credit_block(second["id"], [b["id"]], "B")

    assert service.get_stats()["all_time_pomos"] == 2
