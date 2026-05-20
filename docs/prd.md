# Family Plan PRD

## 1. Vision

做一个足够简单、足够好坚持的亲子计划系统：家长负责安排，孩子负责执行，系统负责展示进度和奖励反馈。

## 2. MVP Goal

验证以下假设：

1. 家长愿意在 Web 端给孩子设置每日计划。
2. 孩子愿意在 iPad 上按卡片式任务执行。
3. 简单的完成反馈、星星和连续打卡能提升坚持率。
4. 家长只需要轻量概览，不需要复杂管理台。

## 3. Users

### Parent

- 使用 Web 管理端。
- 创建孩子档案。
- 设置计划和任务。
- 查看当天/本周完成状态。
- 设置简单奖励规则。

### Child

- 使用 iPad Web/PWA。
- 不注册账号。
- 通过家长生成的访问码或二维码绑定设备。
- 查看今日任务。
- 点击完成并选择简单反馈。

## 4. MVP Scope

### P0 Must Have

- 用户名密码登录家长端。
- 创建孩子档案。
- 生成孩子端访问码。
- 家长创建计划。
- 家长创建每日任务。
- 孩子端查看今日任务。
- 孩子端标记任务完成。
- 家长端查看完成状态。
- 基础星星奖励。
- 连续完成天数。

### P1 Nice To Have

- 周完成率。
- 简单周报。
- 徽章。
- 任务困难/情绪反馈趋势。
- 家长手动补发奖励。

### Out Of Scope

- AI 自动规划。
- 社区、排行榜、朋友圈分享裂变。
- 教师/机构端。
- 复杂商城或虚拟货币兑换。
- 原生 iOS/Android App。
- 多家庭协作。
- 复杂审批流。

## 5. Core Flow

```text
Parent opens Mini Program
-> creates child profile
-> creates a plan
-> adds daily tasks
-> opens child access code
-> child binds iPad PWA
-> child views today's tasks
-> child completes tasks
-> parent sees status and stars
```

## 6. Page List

### Parent Mini Program

- Home: 今日完成概览。
- Children: 孩子列表和绑定入口。
- Plan List: 计划列表。
- Plan Create/Edit: 创建和编辑计划。
- Plan Detail: 任务列表、完成状态、孩子访问码。
- Report: 本周完成率和连续天数。

### Child iPad PWA

- Bind: 输入访问码绑定设备。
- Today: 今日任务大卡片。
- Task Detail: 任务说明和完成按钮。
- Done: 今日完成反馈和奖励展示。
- Rewards: 星星、连续天数、徽章占位。

## 7. Success Metrics

- 家长创建第一个计划的完成率。
- 孩子端成功绑定率。
- 首日任务完成率。
- 7 日内至少完成 3 天的家庭比例。
- 家长一周内回访小程序次数。

## 8. Product Principles

- 孩子端不做管理功能。
- 家长端不要求复杂配置。
- 奖励先轻量，不制造家长维护负担。
- 数据先能解释，不追求复杂智能。
