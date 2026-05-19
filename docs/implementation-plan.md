# Implementation Plan

## Phase 0: Project Foundation

Target: 1-2 days.

- Create repo structure.
- Choose backend package manager.
- Add FastAPI skeleton.
- Add PostgreSQL Docker Compose.
- Add health endpoint.
- Add basic environment config.

Done when:

- Backend starts locally.
- `/health` returns OK.
- Database connection is configured.

## Phase 1: Backend Core

Target: 3-4 days.

- Parent WeChat auth stub.
- Children CRUD.
- Child access code generation.
- Child device binding.
- Plans CRUD.
- Task template creation.
- Daily task generation for today.

Done when:

- Parent can create child and plan through API.
- Child token can fetch today's tasks.

## Phase 2: Parent Mini Program MVP

Target: 4-5 days.

- WeChat login flow.
- Child list page.
- Plan list page.
- Plan creation form.
- Plan detail with tasks.
- Access code display.
- Basic dashboard.

Done when:

- Parent can create a plan in the Mini Program.
- Parent can see whether tasks are completed.

## Phase 3: Child iPad PWA MVP

Target: 4-5 days.

- Device binding page.
- Today task board.
- Task complete action.
- Reward stars display.
- Current streak display.
- iPad-friendly responsive layout.

Done when:

- Child can bind once and use without login.
- Child can complete today's task on iPad.

## Phase 4: Rewards and Reports

Target: 2-3 days.

- Star ledger.
- Streak calculation.
- Parent weekly summary.
- Child completion celebration.

Done when:

- Completing tasks awards stars.
- Parent sees weekly completion rate.

## Phase 5: End-to-End QA

Target: 2 days.

- Test parent creates plan.
- Test child binds iPad.
- Test child completes task.
- Test parent dashboard updates.
- Test empty states.
- Test expired access code.

Done when:

- The core loop works without manual database edits.

## Explicit Non-Goals For MVP

- AI suggestions.
- Push notifications.
- Social sharing.
- Teacher accounts.
- Complex recurrence rules.
- Native iOS App.
- Payment or subscription.

## Suggested First Build Order

1. Backend schema and API.
2. Child PWA, because it validates the execution surface quickly.
3. Parent Mini Program creation flow.
4. Rewards and dashboard.

This order exposes the riskiest UX issue early: whether the iPad child experience is simple enough.
