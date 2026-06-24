from datetime import timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.models import Base, Block, utcnow
from backend.repository import Repository
from backend.service import NotFoundError, Service


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
    # Credit the first session before starting the second — one running block at
    # a time, the way the client drives it.
    first = service.start_block(a["id"], 25)
    service.credit_block(first["id"], [a["id"], b["id"]], "A + B")
    second = service.start_block(b["id"], 25)
    service.credit_block(second["id"], [b["id"]], "B")

    assert service.get_stats()["all_time_pomos"] == 2


def test_start_block_closes_previous_open_block(service):
    # Regression: running_block is a singleton. Starting a new block while one is
    # still open (a second tab/device, or a failed end) must abandon the old one,
    # not leave two open blocks that both credit into duplicate pomos.
    a = service.create_task_from_raw("task A")
    b = service.create_task_from_raw("task B")
    first = service.start_block(a["id"], 25)
    second = service.start_block(b["id"], 25)

    running = service.get_dashboard()["running_block"]
    assert running["id"] == second["id"]  # only the newest block runs

    # The superseded block is closed-not-completed; crediting it is rejected, so
    # it never becomes a duplicate pomo.
    with pytest.raises(NotFoundError):
        service.credit_block(first["id"], [a["id"]], "stale")
    assert service.get_stats()["all_time_pomos"] == 0


def _backdate(service, block_id, minutes):
    block = service._repo._session.get(Block, block_id)
    block.started_at = utcnow() - timedelta(minutes=minutes)
    service._repo._session.flush()


def test_start_block_keeps_finished_leftover_credited(service):
    # VAL-BUG1-001: a leftover block that already ran its full duration is a
    # finished pomo only awaiting credit. The single-open-block sweep must keep it
    # (credit its anchor), not silently abort it, when a new pomo starts.
    a = service.create_task_from_raw("task A")
    b = service.create_task_from_raw("task B")
    first = service.start_block(a["id"], 25)
    _backdate(service, first["id"], 26)  # past its 25-min duration

    service.start_block(b["id"], 25)

    pomos = service.get_history()["pomos"]
    assert [p["task_name"] for p in pomos] == ["task A"]
    assert service.get_stats()["all_time_pomos"] == 1


def test_create_block_seeds_running_deadline(service):
    # A fresh block carries an absolute deadline (started_at + duration) so a
    # reload before the client's first timer sync still rehydrates from a
    # deadline, not the old elapsed heuristic.
    a = service.create_task_from_raw("task A")
    block = service.start_block(a["id"], 25)
    rb = service.get_dashboard()["running_block"]
    assert rb["id"] == block["id"]
    assert rb["paused_remaining_s"] is None
    assert rb["deadline_ms"] is not None
    started = service._repo._session.get(Block, block["id"]).started_at
    if started.tzinfo is None:  # sqlite stores tz-naive; treat as UTC like the repo
        started = started.replace(tzinfo=timezone.utc)
    assert rb["deadline_ms"] == int(started.timestamp() * 1000) + 25 * 60_000


def test_set_block_timer_running_then_paused(service):
    # The client pushes deadline while running and remaining while paused; exactly
    # one is set on the open block, and the dashboard reflects it for rehydrate.
    a = service.create_task_from_raw("task A")
    block = service.start_block(a["id"], 25)

    service.set_block_timer(block["id"], deadline_ms=1_900_000_000_000, paused_remaining_s=None)
    rb = service.get_dashboard()["running_block"]
    assert rb["deadline_ms"] == 1_900_000_000_000
    assert rb["paused_remaining_s"] is None

    service.set_block_timer(block["id"], deadline_ms=None, paused_remaining_s=742)
    rb = service.get_dashboard()["running_block"]
    assert rb["deadline_ms"] is None
    assert rb["paused_remaining_s"] == 742


def test_set_block_timer_rejects_ended_block(service):
    a = service.create_task_from_raw("task A")
    block = service.start_block(a["id"], 25)
    service.end_block(block["id"], completed=False)
    with pytest.raises(NotFoundError):
        service.set_block_timer(block["id"], deadline_ms=123, paused_remaining_s=None)


def test_credit_lands_on_finished_leftover_closed_by_sweep(service):
    # A finished pomo sits in the credit modal; a concurrent start sweeps its
    # full-duration block to completed. The user's Confirm must still land on
    # that already-completed block (re-credit it) instead of 404ing — otherwise
    # the client's retry loop re-opens the modal forever and the pomo is lost.
    a = service.create_task_from_raw("task A")
    b = service.create_task_from_raw("task B")
    first = service.start_block(a["id"], 25)
    _backdate(service, first["id"], 26)  # finished pomo
    service.start_block(b["id"], 25)     # sweep ends `first` as completed

    # Confirm credits the finished block to the user's pick, with their note.
    assert service.credit_block(first["id"], [a["id"]], "shipped it") == 1
    block = service._repo._session.get(Block, first["id"])
    assert block.completed is True
    assert block.note == "shipped it"
    assert service.get_stats()["all_time_pomos"] == 1  # one pomo, not doubled
