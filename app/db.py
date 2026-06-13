from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings

_engine: Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None


def _ensure_engine() -> None:
    global _engine, _SessionLocal
    if _engine is None:
        _engine = create_engine(
            get_settings().database_url, pool_pre_ping=True, future=True
        )
        _SessionLocal = sessionmaker(
            bind=_engine, autoflush=False, expire_on_commit=False
        )


def get_engine() -> Engine:
    _ensure_engine()
    assert _engine is not None
    return _engine


def get_session() -> Generator[Session, None, None]:
    _ensure_engine()
    assert _SessionLocal is not None
    session = _SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
