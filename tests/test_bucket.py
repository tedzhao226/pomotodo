import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.errors import NotFoundError, ValidationError
from backend.models import Base
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
def service(session):
    return Service(Repository(session))


def test_create_defaults_to_today_with_sort_order(service):
    a = service.create_task_from_raw("first")
    b = service.create_task_from_raw("second")
    assert a["bucket"] == "today"
    assert a["sort_order"] == 0
    assert b["sort_order"] == 1


def test_move_to_backlog_rehomes_at_end(service):
    a = service.create_task_from_raw("a")
    service.create_task_from_raw("b")
    moved = service.update_task(a["id"], bucket="backlog")
    assert moved["bucket"] == "backlog"
    # First task in the (empty) backlog gets sort_order 0.
    assert moved["sort_order"] == 0
    dashboard = service.get_dashboard()
    surfaced = next(t for t in dashboard["tasks"] if t["id"] == a["id"])
    assert surfaced["bucket"] == "backlog"


def test_invalid_bucket_raises(service):
    task = service.create_task_from_raw("x")
    with pytest.raises(ValidationError, match="bucket"):
        service.update_task(task["id"], bucket="later")


def test_reorder_sets_sort_order(service):
    a = service.create_task_from_raw("a")
    b = service.create_task_from_raw("b")
    c = service.create_task_from_raw("c")
    service.reorder_tasks("today", [c["id"], a["id"], b["id"]])
    by_id = {t["id"]: t for t in service.list_tasks()}
    assert by_id[c["id"]]["sort_order"] == 0
    assert by_id[a["id"]]["sort_order"] == 1
    assert by_id[b["id"]]["sort_order"] == 2


def test_reorder_rejects_foreign_bucket(service):
    a = service.create_task_from_raw("a")
    b = service.create_task_from_raw("b")
    service.update_task(b["id"], bucket="backlog")
    with pytest.raises(ValidationError, match="not in today"):
        service.reorder_tasks("today", [a["id"], b["id"]])


def test_only_completed_blocks_count_toward_task(service):
    task = service.create_task_from_raw("focus")
    aborted = service.start_block(task["id"], 30)
    service.end_block(aborted["id"], False)  # force stop -> not counted

    done = next(t for t in service.get_dashboard()["tasks"] if t["id"] == task["id"])
    assert done["blocks_done"] == 0

    finished = service.start_block(task["id"], 30)
    service.end_block(finished["id"], True)  # natural completion -> counts

    done = next(t for t in service.get_dashboard()["tasks"] if t["id"] == task["id"])
    assert done["blocks_done"] == 1


def _blocks_done(service, task_id):
    task = next(t for t in service.get_dashboard()["tasks"] if t["id"] == task_id)
    return task["blocks_done"]


def test_credit_block_credits_each_checked_task(service):
    a = service.create_task_from_raw("a")
    b = service.create_task_from_raw("b")
    c = service.create_task_from_raw("c")
    block = service.start_block(a["id"], 30)  # block opened on A
    credited = service.credit_block(block["id"], [a["id"], b["id"]])
    assert credited == 2
    assert _blocks_done(service, a["id"]) == 1  # anchor reused
    assert _blocks_done(service, b["id"]) == 1  # extra completed block
    assert _blocks_done(service, c["id"]) == 0  # untouched


def test_credit_block_unchecked_anchor_is_discarded(service):
    a = service.create_task_from_raw("a")
    b = service.create_task_from_raw("b")
    block = service.start_block(a["id"], 30)
    credited = service.credit_block(block["id"], [b["id"]])  # A unchecked
    assert credited == 1
    assert _blocks_done(service, a["id"]) == 0  # anchor discarded
    assert _blocks_done(service, b["id"]) == 1


def test_credit_block_unknown_task_raises(service):
    a = service.create_task_from_raw("a")
    block = service.start_block(a["id"], 30)
    with pytest.raises(NotFoundError):
        service.credit_block(block["id"], [a["id"], 9999])


def test_credit_block_dedupes_task_ids(service):
    a = service.create_task_from_raw("a")
    b = service.create_task_from_raw("b")
    block = service.start_block(a["id"], 30)
    # Duplicate ids must not double-credit a task.
    credited = service.credit_block(block["id"], [a["id"], a["id"], b["id"], b["id"]])
    assert credited == 2
    assert _blocks_done(service, a["id"]) == 1
    assert _blocks_done(service, b["id"]) == 1


def test_credit_block_unknown_block_raises(service):
    a = service.create_task_from_raw("a")
    with pytest.raises(NotFoundError):
        service.credit_block(9999, [a["id"]])


def test_discarded_block_not_in_stats(service):
    task = service.create_task_from_raw("focus")
    aborted = service.start_block(task["id"], 30)
    service.end_block(aborted["id"], False)  # discard
    assert service.get_stats()["all_time_pomos"] == 0

    finished = service.start_block(task["id"], 30)
    service.end_block(finished["id"], True)  # natural completion
    assert service.get_stats()["all_time_pomos"] == 1


def test_tag_summary_counts_completed_only(service):
    task = service.create_task_from_raw("focus #work")
    aborted = service.start_block(task["id"], 30)
    service.end_block(aborted["id"], False)  # discard
    tags = {t["tag"]: t for t in service.get_dashboard()["tags"]}
    assert tags.get("work", {"blocks": 0})["blocks"] == 0

    finished = service.start_block(task["id"], 30)
    service.end_block(finished["id"], True)
    tags = {t["tag"]: t for t in service.get_dashboard()["tags"]}
    assert tags["work"]["blocks"] == 1


def test_edit_name_reparses_tags_and_estimate(service):
    task = service.create_task_from_raw("PTE #learn")
    updated = service.update_task(task["id"], name="PTE drill #urgent *5")
    assert updated["name"] == "PTE drill"
    assert updated["tags"] == ["urgent"]  # new #tags replace the old set
    assert updated["estimate_blocks"] == 5


def test_edit_name_without_markers_keeps_tags(service):
    task = service.create_task_from_raw("PTE #learn *3")
    updated = service.update_task(task["id"], name="PTE practice")
    assert updated["name"] == "PTE practice"
    assert updated["tags"] == ["learn"]
    assert updated["estimate_blocks"] == 3  # untouched


def test_delete_archives_and_keeps_history(service):
    task = service.create_task_from_raw("focus")
    block = service.start_block(task["id"], 30)
    service.end_block(block["id"], True)
    assert service.get_stats()["all_time_pomos"] == 1

    service.delete_task(task["id"])
    # gone from the todo list
    assert all(t["id"] != task["id"] for t in service.get_dashboard()["tasks"])
    # history intact
    assert service.get_stats()["all_time_pomos"] == 1
    history = service.get_history()
    assert len(history["pomos"]) == 1
    todo = next(t for t in history["todos"] if t["id"] == task["id"])
    assert todo["archived"] is True
    assert todo["blocks_done"] == 1


def test_clear_completed_archives_keeps_history(service):
    task = service.create_task_from_raw("focus")
    service.update_task(task["id"], status="done")
    block = service.start_block(task["id"], 30)
    service.end_block(block["id"], True)

    service.clear_completed_tasks()
    assert all(t["id"] != task["id"] for t in service.get_dashboard()["tasks"])
    assert service.get_stats()["all_time_pomos"] == 1
    history = service.get_history()
    assert any(t["id"] == task["id"] and t["archived"] for t in history["todos"])


def test_reorder_ignores_archived(service):
    a = service.create_task_from_raw("a")
    b = service.create_task_from_raw("b")
    service.delete_task(b["id"])
    with pytest.raises(ValidationError, match="not in today"):
        service.reorder_tasks("today", [a["id"], b["id"]])


def test_note_round_trip(service):
    task = service.create_task_from_raw("x")
    assert task["note"] == ""
    service.update_task(task["id"], note="**ship** it\n- step 1")
    surfaced = next(
        t for t in service.get_dashboard()["tasks"] if t["id"] == task["id"]
    )
    assert surfaced["note"] == "**ship** it\n- step 1"


def test_dashboard_orders_today_by_sort_order(service):
    a = service.create_task_from_raw("a")
    b = service.create_task_from_raw("b")
    service.reorder_tasks("today", [b["id"], a["id"]])
    today = [t for t in service.get_dashboard()["tasks"] if t["bucket"] == "today"]
    assert [t["id"] for t in today] == [b["id"], a["id"]]
