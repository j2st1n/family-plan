import importlib

import pytest


class TestJWTSecretValidation:
    def test_empty_secret_rejected(self, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.jwt_secret", "")
        with pytest.raises(RuntimeError, match="JWT_SECRET is required"):
            importlib.reload(__import__("app.main", fromlist=["_"]))

    def test_short_secret_rejected(self, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.jwt_secret", "123")
        with pytest.raises(RuntimeError, match="at least 32"):
            importlib.reload(__import__("app.main", fromlist=["_"]))

    def test_forbidden_secret_rejected(self, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.jwt_secret", "family-plan-dev")
        with pytest.raises(RuntimeError, match="default value"):
            importlib.reload(__import__("app.main", fromlist=["_"]))
