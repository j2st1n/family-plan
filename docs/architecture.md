# Architecture

## 1. Recommended MVP Architecture

```text
┌──────────────────────┐      ┌────────────────────┐      ┌──────────────────┐
│ Parent Mini Program  │─────▶│ FastAPI REST API    │◀────│ Child iPad PWA   │
│ WeChat login         │      │ Auth, plans, tasks  │      │ Device token     │
│ Plan management      │      │ Rewards, reports    │      │ Today's tasks    │
└──────────────────────┘      └─────────┬──────────┘      └──────────────────┘
                                        │
                              ┌─────────▼──────────┐
                              │ PostgreSQL          │
                              │ Core relational DB  │
                              └────────────────────┘
```

## 2. Components

### Backend

- FastAPI for REST API.
- SQLAlchemy for ORM.
- PostgreSQL for production data.
- Docker Compose for local development.
- JWT for parent API auth.
- Long-lived device token for child iPad PWA.

### Parent Mini Program

- WeChat Mini Program as the parent surface.
- Uses WeChat login code exchange.
- Owns plan creation, child profile management, and status review.

### Child PWA

- iPad-first responsive Web/PWA.
- Large cards, large buttons, minimal text input.
- Uses access code once, then stores a device token.
- No parent management features.

## 3. Auth Model

### Parent

1. Mini Program calls `wx.login`.
2. Backend exchanges login code for WeChat OpenID.
3. Backend creates or finds parent user.
4. Backend returns JWT.

### Child

1. Parent generates child access code.
2. Child opens PWA on iPad.
3. Child enters access code.
4. Backend returns device token scoped to one child.
5. PWA stores token locally.

## 4. Key Decisions

- Use one backend for both clients to avoid duplicated business rules.
- Keep child auth passwordless to reduce friction.
- Start without real-time updates; parent can pull to refresh.
- Start without push notifications; add WeChat service messages later if needed.
- Keep recurrence simple at first: daily tasks on selected weekdays. Full RRULE can be added after MVP.

## 5. Later Expansion

- AI weekly summaries.
- Plan optimization suggestions.
- WeChat completion notifications.
- Offline-first child PWA cache.
- Multi-child dashboard.
