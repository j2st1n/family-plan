# Backend

FastAPI backend for Family Plan MVP.

## Local Development

Start PostgreSQL:

```bash
docker compose -f docker-compose.dev.yml up -d
```

Run API from this directory:

```bash
uv venv
uv pip install -e .
uvicorn app.main:app --reload
```

Health checks:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/health/db
```

## Database Migrations

```bash
uv run alembic revision --autogenerate -m "message"
uv run alembic upgrade head
```

## Phase 1 Smoke Test

```bash
TOKEN=$(curl -sS -X POST http://127.0.0.1:8000/api/v1/auth/wechat \
  -H 'Content-Type: application/json' \
  -d '{"code":"dev"}' | python -c 'import json,sys; print(json.load(sys.stdin)["token"])')

CHILD_ID=$(curl -sS -X POST http://127.0.0.1:8000/api/v1/children \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"小朋友","grade_label":"二年级"}' | python -c 'import json,sys; print(json.load(sys.stdin)["id"])')

CODE=$(curl -sS -X POST http://127.0.0.1:8000/api/v1/children/$CHILD_ID/access-code \
  -H "Authorization: Bearer $TOKEN" | python -c 'import json,sys; print(json.load(sys.stdin)["code"])')

curl -sS -X POST http://127.0.0.1:8000/api/v1/child-devices/bind \
  -H 'Content-Type: application/json' \
  -d "{\"code\":\"$CODE\",\"display_name\":\"iPad\"}"
```
