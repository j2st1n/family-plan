# API Contract

Base path: `/api/v1`

REST responses are JSON. All timestamps are UTC ISO-8601 strings. Event streams use `text/event-stream`.

## 1. Error Shape

```json
{
  "error": {
    "code": "not_found",
    "message": "Resource not found"
  }
}
```

## 2. Parent Auth

### POST /auth/register

Register with username and password.

Request:

```json
{
  "username": "j2st1n",
  "password": "secret123"
}
```

Response (201):

```json
{
  "token": "jwt",
  "parent": {
    "id": "uuid",
    "nickname": "j2st1n"
  }
}
```

### POST /auth/login

Login with username and password.

Request:

```json
{
  "username": "j2st1n",
  "password": "secret123"
}
```

Response:

```json
{
  "token": "jwt",
  "parent": {
    "id": "uuid",
    "nickname": "j2st1n"
  }
}
```

## 3. Children

### GET /children

List current parent's children.

### POST /children

Create child profile.

Request:

```json
{
  "name": "小朋友",
  "grade_label": "二年级"
}
```

### POST /children/{child_id}/access-code

Generate iPad binding access code.

Response:

```json
{
  "code": "482913",
  "expires_at": "2026-05-18T12:00:00Z"
}
```

## 4. Child Device Binding

### POST /child-devices/bind

Used by iPad PWA.

Request:

```json
{
  "code": "482913",
  "display_name": "iPad"
}
```

Response:

```json
{
  "device_token": "child-device-token",
  "child": {
    "id": "uuid",
    "name": "小朋友"
  }
}
```

## 5. Plans

### GET /plans

Parent lists plans. Query params: `child_id`, `status`.

### POST /plans

Parent creates plan with task templates.

Request:

```json
{
  "child_id": "uuid",
  "title": "每日学习习惯",
  "description": "先完成基础学习闭环",
  "start_date": "2026-05-18",
  "tasks": [
    {
      "title": "阅读 20 分钟",
      "expected_minutes": 20,
      "weekdays": [1, 2, 3, 4, 5],
      "reward_stars": 1
    }
  ]
}
```

### GET /plans/{plan_id}

Parent gets plan detail.

### PATCH /plans/{plan_id}

Parent updates plan metadata.

### DELETE /plans/{plan_id}

Archive plan.

## 6. Daily Tasks

### GET /child/today

Child PWA gets today's tasks. Auth: child device token.

Response:

```json
{
  "date": "2026-05-18",
  "child": {
    "id": "uuid",
    "name": "小朋友"
  },
  "tasks": [
    {
      "id": "uuid",
      "title": "阅读 20 分钟",
      "expected_minutes": 20,
      "reward_stars": 1,
      "status": "pending"
    }
  ],
  "rewards": {
    "stars_total": 12,
    "current_streak_days": 3
  }
}
```

### PATCH /child/tasks/{task_id}/complete

Child marks task complete.

Request:

```json
{
  "feedback": "easy"
}
```

Response:

```json
{
  "task_id": "uuid",
  "status": "completed",
  "stars_awarded": 1,
  "current_streak_days": 3
}
```

## 7. Parent Dashboard

### GET /children/{child_id}/dashboard

Parent gets lightweight completion summary.

Response:

```json
{
  "child_id": "uuid",
  "today": {
    "total_tasks": 3,
    "completed_tasks": 2
  },
  "week": {
    "completion_rate": 0.76,
    "completed_days": 4
  },
  "rewards": {
    "stars_total": 12,
    "current_streak_days": 3
  }
}
```

## 8. Realtime Events

Realtime endpoints are notification-only. They do not send task, shop, or child records directly; clients receive a topic-level change event and then re-fetch the relevant REST endpoint.

Event payload:

```json
{
  "topic": "tasks",
  "parent_id": "uuid",
  "child_id": "uuid-or-null",
  "reason": "task_completed",
  "version": 123
}
```

Topics:

| Topic | Meaning |
|---|---|
| `tasks` | Daily task, routine, plan, schedule, or completion data changed. |
| `shop` | Shop item, wish, redemption, or fulfillment data changed. |
| `children` | Child profile or device binding data changed. |

### GET /events/parent

Parent SSE stream. Auth: parent Bearer JWT.

Response content type: `text/event-stream`.

Example event:

```text
event: update
data: {"topic":"tasks","parent_id":"uuid","child_id":"uuid","reason":"task_completed","version":12}

```

The parent stream receives all events scoped to the authenticated parent.

### GET /child/events

Child SSE stream. Auth: child device Bearer token.

Response content type: `text/event-stream`.

The child stream receives events for its child ID plus parent-wide events where `child_id` is `null`.
