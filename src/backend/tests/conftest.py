import pytest
from fastapi.testclient import TestClient
from app.core.ratelimit import auth_limiter, bind_limiter
from app.db.session import SessionLocal
from app.main import create_app


@pytest.fixture(autouse=True)
def reset_rate_limiters():
    auth_limiter._global._buckets.clear()
    auth_limiter._limiters.clear()
    bind_limiter._global._buckets.clear()
    bind_limiter._limiters.clear()


@pytest.fixture
def client():
    return TestClient(create_app())


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
