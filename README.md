# Family Plan

家长安排计划，孩子在 iPad 上查看并完成任务的亲子计划系统。

## Quick Start

```bash
docker compose up -d
```

API: `http://127.0.0.1:8000`

## Development

```bash
# Backend
cd src/backend && uv run uvicorn app.main:app --reload

# Parent Web
cd src/parent-web && npx vite

# Child PWA
cd src/child-pwa && npx vite
```

## Documents

- [PRD](docs/prd.md)
- [Architecture](docs/architecture.md)
- [Data Model](docs/data-model.md)
- [API Contract](docs/api.md)
- [Implementation Plan](docs/implementation-plan.md)
