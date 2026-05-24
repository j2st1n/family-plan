import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException

from app.core.config import settings
from app.routes.auth import router as auth_router
from app.routes.children import router as children_router
from app.routes.daily_tasks import parent_router as parent_daily_router, router as daily_tasks_router
from app.routes.devices import router as devices_router
from app.routes.events import router as events_router
from app.routes.health import router as health_router
from app.routes.plans import router as plans_router
from app.routes.shop import child_router as child_shop_router, router as shop_router

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


def create_app() -> FastAPI:
    _validate_jwt_secret()
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
    app.include_router(events_router, prefix="/api/v1")
    app.include_router(plans_router, prefix="/api/v1")
    app.include_router(daily_tasks_router, prefix="/api/v1")
    app.include_router(parent_daily_router, prefix="/api/v1")
    app.include_router(shop_router, prefix="/api/v1")
    app.include_router(child_shop_router, prefix="/api/v1")

    if os.path.isdir("/app/static-built/assets"):
        app.mount("/assets", StaticFiles(directory="/app/static-built/assets"), name="assets")

    @app.get("/{full_path:path}", response_class=HTMLResponse)
    async def serve_frontend(request: Request, full_path: str):
        host = request.headers.get("host", "")
        is_kids = "kids" in host
        is_mom = "mom" in host
        if is_kids or is_mom:
            frontend = "child" if is_kids else "parent"
            index_path = f"/app/static-built/{frontend}/index.html"
            if os.path.isfile(index_path):
                return FileResponse(index_path)
        raise HTTPException(status_code=404)

    return app


app = create_app()
