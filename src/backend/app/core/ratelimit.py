import time
from collections import defaultdict
from collections.abc import Callable

from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._buckets: dict[str, list[float]] = defaultdict(list)

    def _clean(self, key: str, now: float) -> None:
        cutoff = now - self.window_seconds
        self._buckets[key] = [t for t in self._buckets[key] if t > cutoff]

    def allow(self, key: str) -> bool:
        now = time.time()
        self._clean(key, now)
        if len(self._buckets[key]) >= self.max_requests:
            return False
        self._buckets[key].append(now)
        return True


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    client = request.client
    return client.host if client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 30, window_seconds: int = 60):
        super().__init__(app)
        self._global = RateLimiter(max_requests, window_seconds)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        ip = get_client_ip(request)
        if not self._global.allow(ip):
            return Response(content='{"detail":{"code":"rate_limited","message":"Too many requests"}}', status_code=status.HTTP_429_TOO_MANY_REQUESTS, media_type="application/json")
        return await call_next(request)


class PerKeyRateLimiter:
    def __init__(self, max_requests: int = 10, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._limiters: dict[str, RateLimiter] = {}
        self._global = RateLimiter(max_requests=30, window_seconds=60)

    def allow(self, *keys: str | None, ip: str = "") -> bool:
        if not self._global.allow(ip):
            return False
        for key in keys:
            if key is None:
                continue
            limiter = self._limiters.get(key)
            if limiter is None:
                limiter = self._limiters[key] = RateLimiter(self.max_requests, self.window_seconds)
            if not limiter.allow(key):
                return False
        return True


auth_limiter = PerKeyRateLimiter(max_requests=5, window_seconds=60)
bind_limiter = PerKeyRateLimiter(max_requests=10, window_seconds=60)
