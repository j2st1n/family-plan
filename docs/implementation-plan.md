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

- Parent username/password auth.
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
- Social sharing (outside the original MVP; parent task image sharing is added in the later work below).
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

## 后续功能与优化（2026-10-30）

- [x] 家长任务页后台静默同步：2026-10-30 随 0.3.29 上线。首次/换日加载与后台同步分离，合并 focus/visibility 触发，按事件顺序减少重复查询，保留断线补拉，离开首页后停止其多余刷新；编辑文字、光标及滚动保留经合成浏览器回归验证。
- [x] 家长任务页分享图片：2026-10-30 随 0.3.28 上线。生成当前选中日期的任务、完成状态和已完成奖励，支持预览、保存及浏览器支持的系统分享；不混入其他日期或当前累计余额。
- [x] 孩子端今日任务分享图片：2026-10-30 随 0.3.30 上线。包含完整任务、完成状态、认可进度与完成奖励，支持姓名隐藏、保存及系统分享，任务操作/失败/无效日期保护；本机、正式构建、隔离真实API适配及家长端回归通过，用户接受人工复核边界后发布。
