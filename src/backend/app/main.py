from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routes.auth import router as auth_router
from app.routes.children import router as children_router
from app.routes.daily_tasks import parent_router as parent_daily_router, router as daily_tasks_router
from app.routes.devices import router as devices_router
from app.routes.health import router as health_router
from app.routes.plans import router as plans_router

FORBIDDEN_SECRETS = {"", "family-plan-dev", "change-me-in-production"}
MIN_SECRET_LENGTH = 32


def _validate_jwt_secret() -> None:
    s = settings.jwt_secret
    if not s:
        raise RuntimeError("JWT_SECRET is required. Set it via environment variable.")
    if s in FORBIDDEN_SECRETS:
        raise RuntimeError(f"JWT_SECRET must not be a default value: {s!r}")
    if len(s) < MIN_SECRET_LENGTH:
        raise RuntimeError(f"JWT_SECRET must be at least {MIN_SECRET_LENGTH} characters (got {len(s)}).")


_validate_jwt_secret()


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:5174", "http://localhost:5174"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(children_router, prefix="/api/v1")
    app.include_router(devices_router, prefix="/api/v1")
    app.include_router(plans_router, prefix="/api/v1")
    app.include_router(daily_tasks_router, prefix="/api/v1")
    app.include_router(parent_daily_router, prefix="/api/v1")
    return app


app = create_app()
