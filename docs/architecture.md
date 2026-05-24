# Architecture

## 1. Current Architecture

```text
┌──────────────────┐      ┌────────────────┐      ┌──────────────────┐
│ Parent Web App   │─────▶│ FastAPI REST/SSE│◀────│ Child iPad PWA   │
│ Login (user/pass)│      │ (API + static)  │      │ Device token     │
│ Plan management  │      │ Auth, plans,    │      │ Today's tasks    │
└──────────────────┘      └────────┬───────┘      └──────────────────┘
                            │      │
                   ┌────────▼──────▼──────────┐
                   │ PostgreSQL (Docker)      │
                   └──────────────────────────┘
```

Production is served through Caddy:
- `mom.xxx` → parent-web (React SPA, served by FastAPI StaticFiles)
- `kids.xxx` → child-pwa (React PWA, served by FastAPI StaticFiles)
- `/api/*` → backend API endpoints

## 2. Components

### Backend
- FastAPI for REST API and static file serving.
- Server-Sent Events notify parent and child clients that task, shop, or child data changed; clients then re-fetch through existing REST endpoints.
- SQLAlchemy for ORM, Alembic for migrations.
- PostgreSQL for production data.
- Docker Compose for deployment (`docker-compose.yml`); `docker-compose.dev.yml` for development.

### Parent Web App
- React + Vite SPA.
- Username/password registration and login (bcrypt + JWT).
- Plan creation, child management, task scheduling, access code generation.

### Child PWA
- React + Vite PWA, iPad-first responsive layout.
- Device binding via 6-digit access code.
- Today's task board with completion, rewards, streak display.

## 3. Auth Model

### Parent
1. Parent registers with username + password.
2. Backend hashes password with bcrypt, stores in `parents` table.
3. Login verifies password hash, returns JWT (7-day expiry).
4. Parent API endpoints require Bearer JWT.

### Child
1. Parent generates access code in parent web app.
2. Child opens PWA on iPad, enters access code.
3. Backend returns device token scoped to one child.
4. Device token expires after 30 days, requires re-binding.
5. PWA stores token in localStorage.

## 4. Key Decisions
- Single backend serves both API and frontend static files.
- Child auth passwordless to reduce friction.
- Real-time refresh is notification-only: SSE events mark `tasks`, `shop`, or `children` as changed, while REST remains the source of truth.
- The current SSE hub is in-process and assumes a single API worker/container; horizontal scaling requires a shared pub/sub layer such as Redis or PostgreSQL LISTEN/NOTIFY.
- Daily tasks with weekday-based recurrence for routines.

## 5. Later Expansion
- AI weekly summaries and plan optimization.
- Push notifications.
- Multi-child dashboard enhancements.
- Device management and revocation.
