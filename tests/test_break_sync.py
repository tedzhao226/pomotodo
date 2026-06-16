import time

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


def _now_ms() -> int:
    return int(time.time() * 1000)


def test_set_and_read_break(service):
    deadline = _now_ms() + 10_000
    service.set_break("shortBreak", deadline)
    assert service.get_dashboard()["break_state"] == {
        "mode": "shortBreak",
        "deadline": deadline,
    }


def test_clear_break(service):
    service.set_break("longBreak", _now_ms() + 10_000)
    service.clear_break()
    assert service.get_dashboard()["break_state"] is None


def test_expired_break_is_none(service):
    service.set_break("shortBreak", _now_ms() - 1_000)  # already past
    assert service.get_dashboard()["break_state"] is None
