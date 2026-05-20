# Data Model

## 1. Principles

- Use UUID primary keys.
- Use UTC timestamps.
- Keep MVP schema small and explicit.
- Parent identity via username/password.
- Child identity is a profile plus device binding, not a login account.

## 2. Core Tables

### parents

```sql
CREATE TABLE parents (
    id UUID PRIMARY KEY,
    wechat_openid VARCHAR(128) UNIQUE,
    username VARCHAR(80) UNIQUE,
    password_hash VARCHAR(255),
    nickname VARCHAR(80),
    avatar_url TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
```

### children

```sql
CREATE TABLE children (
    id UUID PRIMARY KEY,
    parent_id UUID NOT NULL REFERENCES parents(id),
    name VARCHAR(80) NOT NULL,
    avatar_url TEXT,
    grade_label VARCHAR(40),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
```

### child_devices

```sql
CREATE TABLE child_devices (
    id UUID PRIMARY KEY,
    child_id UUID NOT NULL REFERENCES children(id),
    device_token_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(80),
    last_seen_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP
);
```

### child_access_codes

```sql
CREATE TABLE child_access_codes (
    id UUID PRIMARY KEY,
    child_id UUID NOT NULL REFERENCES children(id),
    code_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL
);
```

### plans

```sql
CREATE TABLE plans (
    id UUID PRIMARY KEY,
    parent_id UUID NOT NULL REFERENCES parents(id),
    child_id UUID NOT NULL REFERENCES children(id),
    title VARCHAR(120) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
```

### task_templates

```sql
CREATE TABLE task_templates (
    id UUID PRIMARY KEY,
    plan_id UUID NOT NULL REFERENCES plans(id),
    title VARCHAR(160) NOT NULL,
    description TEXT,
    expected_minutes INT,
    weekdays INT[] NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    reward_stars INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
```

### daily_tasks

```sql
CREATE TABLE daily_tasks (
    id UUID PRIMARY KEY,
    child_id UUID NOT NULL REFERENCES children(id),
    plan_id UUID NOT NULL REFERENCES plans(id),
    task_template_id UUID REFERENCES task_templates(id),
    task_date DATE NOT NULL,
    title VARCHAR(160) NOT NULL,
    description TEXT,
    expected_minutes INT,
    reward_stars INT NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMP,
    child_feedback VARCHAR(20),
    created_by VARCHAR(20) NOT NULL DEFAULT 'parent',
    approved BOOLEAN NOT NULL DEFAULT TRUE,
    schedule_by VARCHAR(20),
    scheduled_start TIME,
    scheduled_end TIME,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
```

### reward_ledger

```sql
CREATE TABLE reward_ledger (
    id UUID PRIMARY KEY,
    child_id UUID NOT NULL REFERENCES children(id),
    source_type VARCHAR(40) NOT NULL,
    source_id UUID,
    stars_delta INT NOT NULL,
    reason VARCHAR(160) NOT NULL,
    created_at TIMESTAMP NOT NULL
);
```

### streaks

```sql
CREATE TABLE streaks (
    id UUID PRIMARY KEY,
    child_id UUID NOT NULL REFERENCES children(id) UNIQUE,
    current_days INT NOT NULL DEFAULT 0,
    longest_days INT NOT NULL DEFAULT 0,
    last_completed_date DATE,
    updated_at TIMESTAMP NOT NULL
);
```

## 3. MVP Indexes

```sql
CREATE INDEX idx_children_parent_id ON children(parent_id);
CREATE INDEX idx_plans_child_status ON plans(child_id, status);
CREATE INDEX idx_daily_tasks_child_date ON daily_tasks(child_id, task_date);
CREATE INDEX idx_reward_ledger_child_created ON reward_ledger(child_id, created_at);
```

## 4. Post-MVP Tables

- achievements
- child_achievements
- weekly_reports
- plan_adjustment_suggestions
- notification_logs
- ai_summary_logs
