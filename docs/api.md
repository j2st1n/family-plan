# API Contract

Base path: `/api/v1`

All responses are JSON. All timestamps are UTC ISO-8601 strings.

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

### POST /auth/wechat

Exchange WeChat login code for parent JWT.

Request:

```json
{
  "code": "wx-login-code"
}
```

Response:

```json
{
  "token": "jwt",
  "parent": {
    "id": "uuid",
    "nickname": "妈妈"
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
