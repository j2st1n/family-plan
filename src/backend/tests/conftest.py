import pytest
from fastapi.testclient import TestClient
from app.db.session import SessionLocal
from app.main import create_app


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
