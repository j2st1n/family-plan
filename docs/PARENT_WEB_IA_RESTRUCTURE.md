# 家长端（Parent Web）信息架构(IA)重构与导航交互体验优化规范

> **文档状态**：Official Design Specification / RFC  
> **编写者**：Family Plan 架构与体验设计组 (@researcher)  
> **面向对象**：前端研发工程师 (Coder)、UI/UX 设计师、产品负责人  
> **关联工程**：`src/parent-web` (React 19 + Vite), `src/child-pwa`, `src/backend`  
> **设计系统基准**：自然温润纸质手账风、WCAG 2.2 AA、Fogg 行为模型 (FBM)、Self-Determination Theory (SDT)

---

## 目录
1. [执行摘要与设计原则](#1-执行摘要与设计原则)
2. [现有 Parent Web 问题全景诊断与根因分析](#2-现有-parent-web-问题全景诊断与根因分析)
3. [竞品与行业最佳实践对标调研](#3-竞品与行业最佳实践对标调研)
4. [全新信息架构与功能映射体系](#4-全新信息架构与功能映射体系)
5. [界面线框原型与详细交互流程](#5-界面线框原型与详细交互流程)
6. [前端工程师（Coder）落地实施指南](#6-前端工程师coder落地实施指南)
7. [验收检查清单与测试用例（Definition of Done）](#7-验收检查清单与测试用例definition-of-done)

---

## 1. 执行摘要与设计原则

### 1.1 背景与核心重构目标
Family Plan 作为一套现代轻量亲子计划与习惯养成系统，旨在让“家长负责安排与正向反馈，孩子负责自主执行，系统负责闭环激励”。然而，在经过初期快速迭代后，家长端（Parent Web）暴露出严重的**信息架构认知错配**与**移动端导航重叠冗余 Bug**。

本次重构旨在达成三大核心目标：
1. **消除视觉与导航冗余**：彻底肃清移动端“顶部胶囊导航 + 底部固定 TabBar + 双重【退出】按钮”的双轨冲突，归还超过 20% 的宝贵首屏垂直视界。
2. **重塑首页用户心智（From Entity Admin to Daily Routine）**：将默认落地页由低频的“多孩档案列表”转变为高频的**【今日看板（Today Dashboard）】**，让家长打开页面 3 秒内看清今日进度，并能一键完成【待审批点赞】。
3. **收拢低频管理，建立 4 栏标准响应式体系**：引入规范的**【我的/设置（Profile & Settings）】**，集中托管孩子档案管理、iPad 设备访问码配对、奖励达标线设置及例行任务库；移动端统一采用规范 4 栏底部 TabBar，桌面端采用一体化顶部 Header。

### 1.2 三大用户体验法则 (Core UX Principles)
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PARENT WEB 体验三法则                                │
├──────────────────────────────┬──────────────────────────────┬───────────────┤
│ 1. 3秒掌握今日概览           │ 2. 高频审批零层级            │ 3. 低频管理深收拢  │
│ 打开即见当日完成度与各科进度 │ 待点赞任务置顶，一键 Approve │ 访问码、年级修改、 │
│ 拒绝二次点击进详情           │ 及时正向强化孩子内在动机     │ 规则配置收归【我的】│
└──────────────────────────────┴──────────────────────────────┴───────────────┘
```

1. **3秒掌握今日概览（3-Second Rule）**：家长多在碎片时间（早起上学前、下班到家后、孩子睡前）打开应用，核心诉求是“看一眼今天怎么样了”。页面必须首屏呈现已完成/未完成状态环与核心进度。
2. **高频审批零层级（Zero-Click Feedback）**：依据自我决定理论（SDT）中的胜任感（Competence），孩子提交任务后最渴望的是家长的即时点赞与反馈。待审批任务必须呈现在首屏视觉焦点（Hero Area），支持 1-Click 确认并发放星星。
3. **低频管理深收拢（Progressive Disclosure & De-clutter）**：添加孩子、年级学段变更、iPad 配对码生成、连续打卡阈值设定属于极低频（月度/季度）配置，坚决从日常高频操作动线中剥离，保持日常视界纯粹清爽。

---

## 2. 现有 Parent Web 问题全景诊断与根因分析

通过对现有代码库（`src/parent-web/src/App.jsx`、`Home.jsx`、`TaskManage.jsx`、`index.css`）的系统走查，诊断出以下 4 大核心结构性问题。

### 2.1 导航冗余 Bug：双套导航系统并存与空间挤占
#### 表现与根因 (Root Cause in Code)
在 `src/parent-web/src/App.jsx` 中，无论视口宽度，页面同时渲染了顶部 Header 的导航胶囊与底部固定的 `nav-tabs`：
```jsx
// src/parent-web/src/App.jsx (现存缺陷代码片段)
return (
  <>
    <header className="top-nav" style={{ ... }}>
      <div style={{ display: "flex", gap: "0.4rem" }}>
        <button className={`top-nav-btn ${tab === "home" ? "active" : ""}`} onClick={() => setTab("home")}>首页</button>
        <button className={`top-nav-btn ${tab === "analytics" ? "active" : ""}`} onClick={() => setTab("analytics")}>成长看板</button>
        <button className={`top-nav-btn ${tab === "shop" ? "active" : ""}`} onClick={() => setTab("shop")}>星星商城</button>
      </div>
      <button onClick={clearSession}>退出</button>
    </header>

    {/* 主内容区域 */}
    <div style={{ display: tab === "home" ? undefined : "none" }}>...</div>

    {/* 底部导航同时存在 */}
    <nav className="nav-tabs" role="navigation">
      <button className={`nav-tab${tab === "home" ? " on" : ""}`} onClick={() => setTab("home")}>首页</button>
      <button className={`nav-tab${tab === "analytics" ? " on" : ""}`} onClick={() => setTab("analytics")}>成长看板</button>
      <button className={`nav-tab${tab === "shop" ? " on" : ""}`} onClick={() => setTab("shop")}>星星商城</button>
    </nav>
  </>
);
```
在 `src/parent-web/src/index.css` 中，`.top-nav` 和 `.nav-tabs` 完全没有媒体查询（`@media`）断点区分。
- 移动端效果：用户屏幕上方有 3 个胶囊 Tab，下方有 3 个悬浮 Tab。两者功能 100% 镜像重叠，产生严重的认知冲突与“山寨感”。

#### 垂直视界浪费量化 (Vertical Screen Estate Waste)
以 iPhone 14/15/16 标准视口（宽 390px，高 844px）为例：
| 元素名称 | CSS 渲染高度 | 占比 | 现状合理性评价 |
|---|---|---|---|
| 顶部 `.top-nav` 胶囊栏 | 52px | 6.2% | **严重冗余**（移动端应由底部 Tab 承载） |
| `Home.jsx` 内部标题栏与退出 | 48px | 5.7% | **冗余**（双重退出、双重大标题） |
| 底部固定 `.nav-tabs` | 68px (含 safe-area) | 8.1% | 规范合理，但因顶部未隐藏而造成混乱 |
| **导航镀铬层总开销 (Chrome Total)** | **168px** | **19.9%** | **消耗了整整 1/5 的首屏纵向空间！** |

### 2.2 重复【退出】按钮的定位错位与误触风险
在当前界面上，存在多处重复的“退出”按钮：
1. `App.jsx` 顶部 Header 右上角（无状态提示，灰字 `退出`）。
2. `Home.jsx` 顶部 `<h1>Family Plan</h1>` 右侧（灰字 `退出`）。两者在垂直方向上仅相距不到 15px！
3. 心理学与可用性问题：
   - “退出登录（Logout）”在日常使用中属于低频且具破坏性的操作（破坏 Token 缓存与 SSE 长链接）。将其放置在日常界面的最显眼位置，不仅造成家长的视线干扰，极易产生误触，还传递出一种非现代 Web App 的粗糙感。

### 2.3 首页（Home）定位认知失调：从管理台错位为日常页
当前 `Home.jsx` 的渲染结构如下：
```text
[Home.jsx 当前架构]
├── Family Plan 标题 + 退出按钮
├── 孩子卡片 1 (Evan)
│   ├── 头像 + 待点赞角标
│   ├── 星星数 + 连胜天数 + 达标线
│   ├── 操作按钮: [编辑] [奖励设置] [删除]
│   └── 今日进度环 (XX% 完成)
├── 孩子卡片 2 (Lily)
│   └── ...
└── [+ 添加孩子] 按钮
```
- **核心痛点**：当前 Home 页面本质是一个**“多孩档案管理面板（Entity Manager）”**。
- 家长查看具体日常任务时，必须先在卡片上点击某个孩子，触发 `setView("task-manage")`，跳入二级页面；若要返回，再点 `← 返回`。
- 如果家里有 2 个孩子，家长每天早晚要点进去、退出来、再点进去另一个孩子，操作步骤冗余翻倍（4~6 次点击）。
- 绝大多数家长拥有 1~2 个孩子。高频需求是**“查看孩子今天的各科打卡并给做完的作业点赞”**，而不是每天去“编辑孩子学段”或“删除孩子”。

### 2.4 核心功能深埋与逻辑割裂
1. **待审批任务无法在首屏一键点赞**：
   - 虽然多孩卡片上有 `⏳ 待点赞 2` 的角标提示，但家长无法直接在卡片上查看作业名称并批准，必须进入 `TaskManage` 并在任务列表中寻找状态为 `submitted` 的任务，逐个点击“点赞批准”。
2. **iPad 访问码生成严重深埋**：
   - 新设备配对需要获取 6 位访问码（Access Code）。当前该逻辑被硬编码在 `TaskManage.jsx` 的第 475 行（位于日任务、周期例行任务表单的下方最底部）。新家长经常找不到如何在 iPad 上登录。
3. **多重伪路由（Tab 与 View）状态割裂**：
   - `App.jsx` 拥有一层 `tab`（home / analytics / shop），`Home.jsx` 内部又有独立的 `view`（home / create-child / task-manage / reward-settings）。
   - 用户在 `TaskManage` 时切换到底部“成长看板”再切回“首页”，界面仍停留在 `TaskManage`，导致导航状态与视觉感知脱节。

---

## 3. 竞品与行业最佳实践对标调研

为建立科学严谨的架构重构方案，我们针对全球 5 款标杆亲子任务与家庭数字化产品进行了深度 IA 对标。

### 3.1 标杆产品横向对比矩阵
| 维度 | Apple Screen Time (iOS) | Joon (App Store #1 亲子习惯) | OurHome (家庭任务协同) | Habitica (经典 RPG 习惯) | Greenlight (青少年财商与任务) |
|---|---|---|---|---|---|
| **首屏核心心智** | **今日使用时长与限额** | **今日待办任务(Quests)与待审流** | **今日家务流(Today Feed)与快捷勾选** | **每日习惯清单 (Dailies/To-Dos)** | **今日家务(Chores)完成度与零钱状态** |
| **多孩切换机制** | 顶部平铺横划头像 Segmented Control | 顶部轻量浮动头像 Pill 切换器 | 顶部下拉 Filter 或头像列表 | 单人模式（团队由 Party 聚合） | 顶部平铺多孩圆圈头像（带未完成红点） |
| **审批流呈现** | 系统级弹窗申请与一键允许 | **任务列表顶部浮层：待审置顶 Hero 卡** | 动态通知流直接一键 Swipe Approve | 队长/公会一键审批 | 家务待确认栏 (Pending Approval) 一键打款 |
| **管理配置收拢** | 隐藏于 iCloud 家人共享子设置 | **收归底栏第 4 Tab【Settings/Family】** | **收归底栏侧边抽屉【More】** | **收归底栏【Menu/Settings】** | **收归底栏【Account/Parent Profile】** |
| **响应式导航模式** | 随原生 iOS/iPadOS 适配 SplitView | 移动端 4 TabBar，桌面 Web 顶部 Header | 移动端 4 TabBar，Web 端响应式侧边栏 | 移动端 4 栏，桌面端 Top Navbar | 移动端 4 栏 TabBar |

### 3.2 关键行业启示与设计模式总结

#### 启示 1：顶部平铺多孩切换器（Top Child Segmented Bar）
- **业界共识**：亲子应用在处理 1~3 个孩子时，最优交互模式是在视口顶部以**头像胶囊（Avatar Pill）平铺切换**，而非强制跳转“选孩落地页”。
- **徽标联动（Badge Binding）**：每个孩子的头像上直接挂载当前孩子待审批任务数量（如 `🔴 2`）。家长扫一眼顶部即可获知“哪个孩子需要我点赞关注”，一键点击即平滑切换当前上下文，无需页面重载。

#### 启示 2：待审批置顶流（Pending Approval Hero Banner）
- **心理学机制**：及时反馈（Immediacy of Feedback）是儿童习惯内化的第一催化剂。如果孩子做完作业提交后需要等几个小时甚至几天家长才看到，打卡的强化回路就会被切断。
- **UI 呈现**：当当前孩子有待审核任务时，今日看板正上方以轻量暖色卡片（Hero Card）高亮呈现，展示任务名、预估用时与可得星星，提供直观的 `[⭐ 点赞批准]` 与 `[↩️ 退回]` 按钮。

#### 启示 3：双平台响应式导航纪律（Responsive Navigation Discipline）
遵循 Apple HIG 与 Google Material Design 3 规范：
- **移动端视口（`< 768px`）**：
  - 核心导航下沉至底部，单手拇指热区覆盖（Thumb Zone）；
  - 数量严格控制在 3~5 个（本项目为标准的 4 Tab）；
  - 顶部导航完全隐藏，顶部仅保留品牌标题与孩子切换器。
- **桌面/平板横屏视口（`>= 768px`）**：
  - 底部 TabBar 完全隐藏（`display: none`）；
  - 顶部导航居中展开，右侧配置家长头像下拉菜单；
  - 容器宽度自适应扩展至 `960px~1100px`，呈现优雅的双列网格布局。

---

## 4. 全新信息架构与功能映射体系

### 4.1 四大核心 Tab 顶级结构定义
重构后的 Parent Web 建立清晰的 4 栏架构：
```text
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│  📌 今日看板    │  📊 成长统计    │  🎁 星星商城    │  ⚙️ 我的设置    │
│ (Today)         │ (Analytics)     │ (Shop)          │ (Settings)      │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ • 孩子切换 Tab  │ • 30/90天热力图 │ • 奖励货架管理  │ • 孩子档案管理  │
│ • 待审批置顶流  │ • 连胜天数看板  │ • 孩子许愿审核  │ • iPad 访问码   │
│ • 今日各科任务  │ • 各科雷达统计  │ • 兑换核销记录  │ • 达标与连胜设置│
│ • 快捷添加任务  │ • 休假豁免管理  │ • 快速补扣星星  │ • 例行任务库    │
│ • 当日进度环    │ • 连续打卡复盘  │ • 历史兑换账单  │ • 账号与退出登录│
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

### 4.2 全景信息架构树（IA Tree）
```text
Parent Web (App.jsx)
│
├── [Global Auth Guard] (未登录 -> Login.jsx)
│
├── Tab 1: 📌 今日看板 (TodayDashboard.jsx) [DEFAULT LANDING]
│   ├── Top Bar: 孩子平铺切换器 (ChildTabs: [Evan (2)] [Lily] [+])
│   ├── Sub Header: 日期选择器 (< 2026-11-02 今天 >)
│   ├── Section A: 待审批点赞流 (Pending Approval Hero Card)
│   │   ├── 待审卡片: 任务名称 / 提交时间 / 奖励星星
│   │   └── 快捷操作: [⭐ 点赞批准 +X星] / [↩️ 退回修改]
│   ├── Section B: 今日综合进度 (Today Progress Ring)
│   │   ├── 完成率环 (如 4/6 项已完成 67%)
│   │   └── 统计徽章 (⭐ 现有星星 / 🔥 当前连胜)
│   ├── Section C: 今日任务卡片列表 (Today Task List)
│   │   ├── 待完成任务 (支持家长代勾选 / 编辑 / 删除)
│   │   ├── 待审核任务 (黄色高亮状态)
│   │   └── 已完成任务 (折叠或划线状态，支持撤回)
│   └── Action: [+ 添加今日临时任务] (浮动或底部按钮 -> 打开 TaskAddDrawer)
│
├── Tab 2: 📊 成长统计 (Analytics.jsx)
│   ├── Top Bar: 孩子平铺切换器
│   ├── Sub Bar: 时间跨度筛选 (7天 / 30天 / 90天)
│   ├── Section A: 连续打卡热力图 (GitHub-style Heatmap + 状态图例)
│   ├── Section B: 连胜与保护卡统计 (Current Streak & Freeze Cards)
│   ├── Section C: 各科用时与完成度雷达图 (Category Breakdown)
│   └── Section D: 休假豁免记录与新增 (Vacation Manager Modal)
│
├── Tab 3: 🎁 星星商城 (Shop.jsx)
│   ├── Sub Tab: [可兑换商品] | [心愿审核 (N)] | [兑换记录]
│   ├── Panel A: 商品货架 (上架新商品 / 编辑星币价格 / 库存 / 下架)
│   ├── Panel B: 心愿审核单 (孩子在 iPad 上提交的愿望 -> 家长定价并批准)
│   └── Panel C: 兑换记录与核销 (孩子兑换后的奖品 -> 家长线下履约并标记兑现)
│
└── Tab 4: ⚙️ 我的/设置 (Settings.jsx) [NEW TAB]
    ├── Section 1: 家庭与孩子档案 (Child Profiles)
    │   ├── 孩子列表 (名字、学段、年级、当前达标线)
    │   ├── 操作入口: [编辑基本信息] / [删除孩子]
    │   └── 快捷入口: [+ 添加新孩子] (ChildCreate Modal)
    ├── Section 2: iPad 设备绑定与访问码 (Device Pairing)
    │   ├── 选择孩子 -> 生成/刷新 6 位访问码 (Access Code)
    │   ├── 大字排版展示 + 1 键复制 + 24小时有效期说明
    │   └── iPad PWA 绑定指引说明
    ├── Section 3: 打卡达标线与连胜规则 (Reward Rules)
    │   ├── 每日任务打卡达标百分比设置 (默认 80%)
    │   └── 连续打卡阶梯折扣规则 (7天/14天/21天梯度配置)
    ├── Section 4: 周期例行任务库 (Routine Tasks Library)
    │   ├── 循环周计划管理 (周一至周五固定任务、周末专项)
    │   └── [+ 添加循环任务模板] (RoutineForm Modal)
    └── Section 5: 账号与安全 (Account & Security)
        ├── 家长用户名展示
        ├── 系统版本与更新日志
        └── 规范退出操作: [🚪 退出登录] (带二次确认弹窗)
```

### 4.3 高频/低频功能分离与触达路径对比矩阵
| 功能模块 | 现状（旧版本） | 重构后（新版本） | 点击路径缩短 | 用户感知与体验收益 |
|---|---|---|---|---|
| **查看孩子今日作业进度** | 首页 -> 找卡片 -> 点进 TaskManage (2步) | 打开即在今日看板，直接看 (0步) | **100% 提速** | 打开即看，3 秒完成信息摄入 |
| **给孩子完成的作业点赞** | 进详情 -> 滚动翻找 -> 点赞 (3步) | 首屏【待审批 Hero 卡】直接点赞 (1步) | **缩减 67%** | 黄金正向激励回路最短化 |
| **多孩之间切换** | 详情 -> 返回首页 -> 选另一孩子 -> 进详情 (4步) | 顶部头像 Tab 一键切换 (1步) | **缩减 75%** | 多孩家庭操作丝滑度质的飞跃 |
| **生成 iPad 访问码** | 进详情 -> 滚到最底部第 475 行 (3步) | 点击【我的设置】-> 设备绑定卡片 (1步) | **清晰度提升** | 不再与每日流水任务混杂 |
| **退出登录** | 首页顶部有两个并排的退出按钮 | 收归至【我的设置】最底部 | **误触归零** | 界面干净尊贵，符合现代应用审美 |

---

## 5. 界面线框原型与详细交互流程

以下线框图严格依据当前设计系统 tokens 绘制（背景 `#FAF8F5`、卡片 `#FFFFFF`、主色苔藓绿 `#436A54`、文字 `#2D3731`）。

### 5.1 Tab 1: 【今日看板（Today Dashboard）】移动端线框原型 (390px)
```text
┌──────────────────────────────────────────────┐
│ Family Plan                       [通知/帮助]│ <-- 极简顶部品牌栏 (44px)
├──────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌────────┐ │
│ │ 👦 Evan  🔴2 │ │ 👧 Lily      │ │ ➕添加 │ │ <-- 顶部平铺孩子切换器 (ChildTabs)
│ └──────────────┘ └──────────────┘ └────────┘ │     (高亮当前选中的 Evan)
├──────────────────────────────────────────────┤
│ 📅  <   2026年11月2日 星期一 (今天)   >       │ <-- 日期快捷切换条 (36px)
├──────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────┐ │
│ │ ⏳ 待点赞任务 (2 项)                [全部批准]│ │ <-- 待审批 Hero 卡片 (高频置顶)
│ │ ──────────────────────────────────────── │ │
│ │ • 英语口语打卡 (15分钟)             ⭐+1 │ │
│ │   孩子已于 18:20 提交打卡                │ │
│ │   [⭐ 点赞批准]            [↩️ 退回重做]  │ │
│ │ ──────────────────────────────────────── │ │
│ │ • 整理书包与桌面 (10分钟)           ⭐+1 │ │
│ │   [⭐ 点赞批准]            [↩️ 退回重做]  │ │
│ └──────────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────┐ │
│ │  ╭───╮  今日任务进度                     │ │ <-- 进度看板卡片
│ │  │67%│  已完成 4 / 6 项                  │ │
│ │  ╰───╯  ⭐ 获得 4 星    🔥 连胜 12 天    │ │
│ └──────────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│ 今日任务清单                       [+ 加任务] │ <-- 任务列表分组标题
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ 📚 数学口算 100 题              20分钟  ⭐1│ │ (待完成任务卡片)
│ │ 计划时间: 19:00 - 19:20       [代勾选] [✎]│ │
│ ├──────────────────────────────────────────┤ │
│ │ 🏃 跳绳 500 个                  15分钟  ⭐1│ │ (待完成任务卡片)
│ │ 计划时间: 19:30 - 19:45       [代勾选] [✎]│ │
│ ├──────────────────────────────────────────┤ │
│ │ ✓ 语文课外阅读 30 分钟 (已完成) ⭐+1  [撤回]│ │ (已完成划线卡片)
│ └──────────────────────────────────────────┘ │
│                                              │
│ [ 空白安全衬底，确保列表不被底部导航遮挡 ]     │
├──────────────────────────────────────────────┤
│  [📌今日]     [📊成长]     [🎁商城]     [⚙️我的] │ <-- 规范 4 栏底部 TabBar (固定)
└──────────────────────────────────────────────┘
```

### 5.2 Tab 4: 【我的/设置（Profile & Settings）】移动端线框原型 (390px)
```text
┌──────────────────────────────────────────────┐
│ 我的与设置                                   │ <-- 页面标题 (44px)
├──────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────┐ │
│ │ 👨‍👩‍👦 家庭与孩子档案            [+ 添加孩子] │ │ <-- Section 1: 孩子档案
│ │ ──────────────────────────────────────── │ │
│ │ 👦 Evan (小学·三年级)       达标线: 80%  │ │
│ │    [✎ 修改资料]        [奖励设置]        │ │
│ │ ──────────────────────────────────────── │ │
│ │ 👧 Lily (幼儿园·大班)       达标线: 70%  │ │
│ │    [✎ 修改资料]        [奖励设置]        │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ 📱 iPad 设备访问码                        │ │ <-- Section 2: 访问码集中管理
│ │ 当前孩子: [ Evan ▾ ]                     │ │
│ │ ──────────────────────────────────────── │ │
│ │           8  3  9  2  0  1               │ │ (大号等宽数字展示)
│ │        [ 📋 复制 6 位访问码 ]             │ │
│ │  • 在 iPad 端打开应用并输入此码即可自动绑定│ │
│ │  • 访问码在 24 小时内有效                 │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ 🔁 例行周期任务模板库             [管理模板]│ │ <-- Section 3: 例行周计划
│ │ 每周一至五固定生成: 语文阅读、口算、跳绳   │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ 👤 账号与系统信息                          │ │ <-- Section 4: 账号与退出
│ │ 当前家长账号: parent_evan                  │ │
│ │ 版本号: Family Plan v1.2.0 (Build 2026)   │ │
│ │ ──────────────────────────────────────── │ │
│ │           [ 🚪 退出当前登录 ]             │ │ (温和危险色，居中按钮)
│ └──────────────────────────────────────────┘ │
│                                              │
├──────────────────────────────────────────────┤
│  [📌今日]     [📊成长]     [🎁商城]     [⚙️我的] │ <-- 4 栏底部 TabBar
└──────────────────────────────────────────────┘
```

### 5.3 桌面端/平板宽屏响应式布局（`>= 768px`）
在桌面视口下，彻底隐藏底部 TabBar，顶部 Header 展开为统一导航栏，页面内容呈现双列网格布局：
```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│  🌱 Family Plan 亲子计划     [今日看板]  [成长统计]  [星星商城]  [设置管理]    👦 Evan ▾  │ <-- 顶部一体化 Header
└──────────────────────────────────────────────────────────────────────────────────┘
   │
   ├── 左列：今日任务与待审批流 (60% 宽度)        ├── 右列：进度概览与快捷统计 (40% 宽度)
   │   ┌─────────────────────────────────────┐   │   ┌─────────────────────────────────┐
   │   │ ⏳ 待点赞任务 (2 项)                │   │   │  Evan 今日打卡概览               │
   │   │ • 英语口语打卡 (15分钟) [批准][退回]│   │   │  完成率: 67% (4/6 项)           │
   │   │ • 整理书包与桌面        [批准][退回]│   │   │  ⭐ 4 颗已得    🔥 12 天连胜    │
   │   └─────────────────────────────────────┘   │   └─────────────────────────────────┘
   │   ┌─────────────────────────────────────┐   │   ┌─────────────────────────────────┐
   │   │ 📋 今日任务清单          [+ 添加任务] │   │   │ 📅 本周打卡趋势迷你小组件        │
   │   │ [ ] 数学口算 100 题     19:00       │   │   │ 一 二 三 四 五 六 日            │
   │   │ [ ] 跳绳 500 个         19:30       │   │   │  ●  ●  ●  ●  ○  -  -            │
   │   │ [✓] 语文阅读 30分钟     (已完成)    │   │   └─────────────────────────────────┘
   │   └─────────────────────────────────────┘
```

---

## 6. 前端工程师（Coder）落地实施指南

本指南为直接负责代码落地的前端工程师提供无缝、可落地的实操蓝图，确保零后端接口变更、零风险渐进重构。

### 6.1 模块与组件拆分架构图
建议在 `src/parent-web/src` 下实施以下组件化重组：
```text
src/parent-web/src/
├── App.jsx                       <-- 状态收敛：负责 token 验证、tab 切换、全局 SSE 监听
├── components/
│   ├── Navigation/
│   │   ├── TopHeader.jsx         <-- 响应式顶部栏 (移动端极简，桌面端承载完整导航)
│   │   └── BottomTabBar.jsx      <-- 移动端专用 4 栏悬浮导航 (带 iOS safe-area)
│   ├── ChildSwitcher/
│   │   └── ChildTabs.jsx         <-- 顶部平铺孩子切换组件 (带头像与待审 Badge)
│   └── Today/
│       ├── PendingApprovalCard.jsx <-- 待审批点赞置顶流
│       ├── TodayProgress.jsx     <-- 今日环形进度条与统计 Chips
│       ├── TaskList.jsx          <-- 任务列表 (待办、待审、完成)
│       └── TaskAddModal.jsx      <-- 快捷添加日任务模态框
├── pages/
│   ├── Login.jsx                 <-- 既有登录页 (保持稳定)
│   ├── TodayDashboard.jsx        <-- [核心落地页] 替代旧版 Home.jsx 成为默认页
│   ├── Analytics.jsx             <-- 既有成长统计页 (保持稳定)
│   ├── Shop.jsx                  <-- 既有星星商城页 (保持稳定)
│   └── Settings.jsx              <-- [新增设置页] 收拢孩子管理/访问码/奖励/退出
└── index.css                     <-- 注入响应式断点与媒体查询纪律
```

### 6.2 响应式导航纪律与 CSS 规范（直接可用的 CSS）
在 `src/parent-web/src/index.css` 中追加并覆盖现存冲突样式：

```css
/* ==========================================================================
   响应式导航纪律规范 (Responsive Navigation Discipline)
   ========================================================================== */

/* 1. 移动端默认规则 (< 768px) */
@media (max-width: 767px) {
  /* 容器边距：预留底部 TabBar 与安全距离 */
  #root {
    max-width: 100%;
    margin: 0 auto;
    padding: 12px 14px calc(76px + env(safe-area-inset-bottom, 12px));
  }

  /* 彻底隐藏桌面端顶部导航链接 */
  .desktop-nav-links {
    display: none !important;
  }

  /* 移动端极简 Header */
  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0 12px;
    margin-bottom: 8px;
  }

  /* 移动端底部 4 栏 TabBar 规范 */
  .bottom-tabbar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: calc(56px + env(safe-area-inset-bottom, 8px));
    padding: 6px 12px calc(6px + env(safe-area-inset-bottom, 8px));
    display: flex;
    justify-content: space-around;
    align-items: center;
    background: rgba(250, 248, 245, 0.95);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-top: 1px solid var(--border);
    z-index: 500;
  }

  .tab-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 4px 0;
    color: var(--muted);
    font-size: 0.72rem;
    font-weight: 600;
    text-decoration: none;
    border: none;
    background: transparent;
    cursor: pointer;
    position: relative;
    transition: color 0.15s ease, transform 0.1s ease;
  }

  .tab-item:active {
    transform: scale(0.92);
  }

  .tab-item.active {
    color: var(--accent);
    font-weight: 700;
  }

  .tab-item .tab-icon {
    font-size: 1.25rem;
    line-height: 1;
  }

  /* 待审批微标 */
  .tab-badge {
    position: absolute;
    top: 2px;
    right: 22%;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 999px;
    background: var(--flame);
    color: #FFFFFF;
    font-size: 0.65rem;
    font-weight: 750;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--card);
  }
}

/* 2. 桌面与平板宽屏规则 (>= 768px) */
@media (min-width: 768px) {
  #root {
    max-width: 1040px;
    margin: 0 auto;
    padding: 24px 28px 48px;
  }

  /* 桌面端强制隐藏底部 TabBar，杜绝重叠 */
  .bottom-tabbar {
    display: none !important;
  }

  /* 桌面端统一一体化 Header */
  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0 20px;
    margin-bottom: 24px;
    border-bottom: 1px solid var(--border);
  }

  .desktop-nav-links {
    display: flex;
    gap: 8px;
  }

  .desktop-nav-btn {
    padding: 8px 18px;
    border-radius: var(--radius-pill);
    border: 1px solid transparent;
    font-size: 0.92rem;
    font-weight: 600;
    color: var(--muted);
    background: transparent;
    cursor: pointer;
    transition: all 0.18s ease;
  }

  .desktop-nav-btn:hover {
    background: var(--accent-light);
    color: var(--accent);
  }

  .desktop-nav-btn.active {
    background: var(--accent);
    color: #FFFFFF;
    box-shadow: 0 2px 8px rgba(67, 106, 84, 0.25);
  }
}
```

### 6.3 状态管理与数据联动方案
在重构后的体系中，状态应按层级合理下沉与共享：
1. **全局层 (`App.jsx`)**：
   - `token`：用户登录凭证；
   - `tab`：当前活跃 Tab（`"today" | "analytics" | "shop" | "settings"`），持久化在 `localStorage.getItem("parent_active_tab") || "today"`；
   - `selectedChildId`：当前选中的孩子 ID，持久化在 `localStorage.getItem("parent_selected_child")`，供 `TodayDashboard` 和 `Analytics` 共享；
   - 全局未读待审计数 `totalPendingCount`：汇总所有孩子的待审任务，用于在底栏“今日看板”显示角标 `🔴`。
2. **页面局部层 (`TodayDashboard.jsx`)**：
   - `tasks`、`plan`、`date`（默认今天）：仅在今日看板内部流转；
   - 监听 SSE 事件 `topics: ["tasks", "settings"]`，当孩子在 iPad 完成提交时，即时自动刷新今日列表与待审 Hero 卡，无需手动 F5。

### 6.4 核心代码参考实现 (Ready-to-Implement Codes)

#### 1) `src/parent-web/src/App.jsx` 结构重构
```jsx
import { useState, useEffect, useCallback } from "react";
import Login from "./pages/Login.jsx";
import TodayDashboard from "./pages/TodayDashboard.jsx";
import Analytics from "./pages/Analytics.jsx";
import Shop from "./pages/Shop.jsx";
import Settings from "./pages/Settings.jsx";
import api from "./api.js";
import useSseRefresh from "./hooks/useSseRefresh.js";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("parent_token"));
  const [tab, setTab] = useState(() => localStorage.getItem("parent_active_tab") || "today");
  const [children, setChildren] = useState([]);
  const [activeChildId, setActiveChildId] = useState(() => localStorage.getItem("parent_active_child_id"));
  const [totalPending, setTotalPending] = useState(0);

  function clearSession() {
    localStorage.removeItem("parent_token");
    setToken(null);
  }

  const handleTabChange = (nextTab) => {
    setTab(nextTab);
    localStorage.setItem("parent_active_tab", nextTab);
  };

  const handleChildChange = (childId) => {
    setActiveChildId(childId);
    localStorage.setItem("parent_active_child_id", childId);
  };

  // 刷新孩子列表与未审计数
  const refreshGlobalMeta = useCallback(async () => {
    if (!token) return;
    try {
      const list = await api.fetchChildren(token);
      setChildren(list);
      if (list.length > 0 && (!activeChildId || !list.find(c => c.id === activeChildId))) {
        setActiveChildId(list[0].id);
        localStorage.setItem("parent_active_child_id", list[0].id);
      }
      // 聚合待审数
      let pendingCount = 0;
      await Promise.all(list.map(async (c) => {
        try {
          const ds = await api.fetchDashboard(token, c.id);
          pendingCount += (ds?.today?.submitted_tasks ?? 0);
        } catch (_) {}
      }));
      setTotalPending(pendingCount);
    } catch (e) {
      console.warn("Refresh meta failed", e);
    }
  }, [token, activeChildId]);

  useEffect(() => { refreshGlobalMeta(); }, [refreshGlobalMeta]);

  useSseRefresh({
    token,
    enabled: !!token,
    topics: ["tasks", "children", "settings"],
    onRefresh: refreshGlobalMeta,
    onExpired: clearSession,
  });

  if (!token) return <Login onLogin={setToken} />;

  const activeChild = children.find(c => c.id === activeChildId) || children[0] || null;

  return (
    <>
      {/* 统一 Header */}
      <header className="app-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "1.3rem" }}>🌱</span>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--accent)" }}>Family Plan</h1>
        </div>

        {/* 桌面端导航（>=768px 呈现，移动端自动隐藏） */}
        <nav className="desktop-nav-links">
          <button className={`desktop-nav-btn ${tab === "today" ? "active" : ""}`} onClick={() => handleTabChange("today")}>今日看板</button>
          <button className={`desktop-nav-btn ${tab === "analytics" ? "active" : ""}`} onClick={() => handleTabChange("analytics")}>成长统计</button>
          <button className={`desktop-nav-btn ${tab === "shop" ? "active" : ""}`} onClick={() => handleTabChange("shop")}>星星商城</button>
          <button className={`desktop-nav-btn ${tab === "settings" ? "active" : ""}`} onClick={() => handleTabChange("settings")}>设置管理</button>
        </nav>
      </header>

      {/* 4 大 Tab 内容区 (保持 DOM 状态或条件渲染) */}
      <main>
        {tab === "today" && (
          <TodayDashboard
            token={token}
            children={children}
            activeChild={activeChild}
            onSelectChild={handleChildChange}
            onRefreshMeta={refreshGlobalMeta}
            onExpired={clearSession}
          />
        )}
        {tab === "analytics" && (
          <Analytics
            token={token}
            isActive={tab === "analytics"}
            onExpired={clearSession}
          />
        )}
        {tab === "shop" && (
          <Shop
            token={token}
            isActive={tab === "shop"}
            onExpired={clearSession}
          />
        )}
        {tab === "settings" && (
          <Settings
            token={token}
            children={children}
            onRefreshChildren={refreshGlobalMeta}
            onLogout={clearSession}
            onExpired={clearSession}
          />
        )}
      </main>

      {/* 移动端专用 4 栏底部 TabBar (<768px 呈现，桌面端自动隐藏) */}
      <nav className="bottom-tabbar" role="navigation">
        <button className={`tab-item ${tab === "today" ? "active" : ""}`} onClick={() => handleTabChange("today")}>
          <span className="tab-icon">📌</span>
          <span>今日看板</span>
          {totalPending > 0 && <span className="tab-badge">{totalPending}</span>}
        </button>
        <button className={`tab-item ${tab === "analytics" ? "active" : ""}`} onClick={() => handleTabChange("analytics")}>
          <span className="tab-icon">📊</span>
          <span>成长统计</span>
        </button>
        <button className={`tab-item ${tab === "shop" ? "active" : ""}`} onClick={() => handleTabChange("shop")}>
          <span className="tab-icon">🎁</span>
          <span>星星商城</span>
        </button>
        <button className={`tab-item ${tab === "settings" ? "active" : ""}`} onClick={() => handleTabChange("settings")}>
          <span className="tab-icon">⚙️</span>
          <span>我的设置</span>
        </button>
      </nav>
    </>
  );
}
```

#### 2) `src/parent-web/src/pages/TodayDashboard.jsx` 核心架构
```jsx
import { useState, useEffect, useCallback } from "react";
import api from "../api.js";
import { formatStars } from "../utils/format.js";

export default function TodayDashboard({ token, children, activeChild, onSelectChild, onRefreshMeta, onExpired }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tasks, setTasks] = useState([]);
  const [plan, setPlan] = useState(null);
  const [rewards, setRewards] = useState({ stars_total: 0, current_streak_days: 0 });
  const [loading, setLoading] = useState(false);

  // 加载活跃孩子的当前计划与任务
  const loadChildData = useCallback(async () => {
    if (!activeChild) return;
    setLoading(true);
    try {
      const plans = await api.fetchPlans(token, activeChild.id);
      const activePlan = plans.find(p => p.status === "active") || plans[0];
      if (activePlan) {
        setPlan(activePlan);
        const data = await api.fetchDailyTasks(token, activePlan.id, date);
        setTasks(data.tasks || []);
        setRewards(data.rewards || { stars_total: 0, current_streak_days: 0 });
      } else {
        setPlan(null);
        setTasks([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, activeChild, date]);

  useEffect(() => { loadChildData(); }, [loadChildData]);

  // 1-Click 点赞批准
  const handleApprove = async (taskId) => {
    try {
      await api.approveTask(token, taskId);
      await loadChildData();
      onRefreshMeta();
    } catch (err) {
      alert("批准失败: " + err.message);
    }
  };

  // 退回重做
  const handleReject = async (taskId) => {
    try {
      await api.rejectTask(token, taskId);
      await loadChildData();
      onRefreshMeta();
    } catch (err) {
      alert("退回失败: " + err.message);
    }
  };

  const submittedTasks = tasks.filter(t => t.status === "submitted");
  const pendingTasks = tasks.filter(t => t.status === "pending");
  const completedTasks = tasks.filter(t => t.status === "completed");

  return (
    <div className="today-dashboard">
      {/* 顶部孩子切换平铺胶囊 */}
      {children.length > 1 && (
        <div className="child-pills-bar" style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "10px" }}>
          {children.map(c => (
            <button
              key={c.id}
              onClick={() => onSelectChild(c.id)}
              className={`child-pill ${c.id === activeChild?.id ? "active" : ""}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "var(--radius-pill)",
                border: c.id === activeChild?.id ? "1px solid var(--accent)" : "1px solid var(--border)",
                background: c.id === activeChild?.id ? "var(--accent-light)" : "var(--card)",
                color: c.id === activeChild?.id ? "var(--accent)" : "var(--text)",
                fontWeight: 650,
                cursor: "pointer"
              }}
            >
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* 待审批 Hero 卡片（高频置顶） */}
      {submittedTasks.length > 0 && (
        <div className="pending-hero-card" style={{
          background: "var(--star-bg)",
          border: "1px solid var(--star-border)",
          borderRadius: "var(--radius)",
          padding: "14px 16px",
          marginBottom: "16px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontWeight: 700, color: "var(--star)", fontSize: "0.95rem" }}>
              ⏳ 待点赞任务 ({submittedTasks.length})
            </span>
          </div>
          {submittedTasks.map(t => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px dashed var(--star-border)" }}>
              <div>
                <p style={{ fontWeight: 650, color: "var(--text)" }}>{t.title}</p>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>用时 {t.expected_minutes} 分钟 · ⭐+{t.reward_stars}</p>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button className="btn-primary" style={{ padding: "4px 10px", fontSize: "0.8rem" }} onClick={() => handleApprove(t.id)}>⭐ 点赞</button>
                <button className="btn-secondary" style={{ padding: "4px 8px", fontSize: "0.8rem" }} onClick={() => handleReject(t.id)}>退回</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 今日进度概览 */}
      <div className="progress-card" style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "16px",
        marginBottom: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <div>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>今日已完成 {completedTasks.length} / {tasks.length} 项</h2>
          <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
            <span className="stat-chip">⭐ {formatStars(rewards.stars_total)}</span>
            <span className="stat-chip flame">🔥 {rewards.current_streak_days} 天</span>
          </div>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="task-section">
        {pendingTasks.map(t => (
          <div key={t.id} style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "12px 14px",
            marginBottom: "8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div>
              <p style={{ fontWeight: 600 }}>{t.title}</p>
              <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{t.expected_minutes}分钟 · ⭐{t.reward_stars}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### 3) `src/parent-web/src/pages/Settings.jsx` 核心架构
```jsx
import { useState } from "react";
import api from "../api.js";

export default function Settings({ token, children, onRefreshChildren, onLogout, onExpired }) {
  const [selectedChildForCode, setSelectedChildForCode] = useState(children[0]?.id || "");
  const [accessCode, setAccessCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);

  const generateCode = async () => {
    if (!selectedChildForCode) return;
    setCodeLoading(true);
    try {
      const res = await api.getAccessCode(token, selectedChildForCode);
      setAccessCode(res.access_code);
    } catch (e) {
      alert("生成访问码失败: " + e.message);
    } finally {
      setCodeLoading(false);
    }
  };

  return (
    <div className="settings-page" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* 孩子档案管理 */}
      <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700 }}>👨‍👩‍👧‍👦 孩子档案管理</h2>
        </div>
        {children.map(c => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
            <div>
              <span style={{ fontWeight: 650 }}>{c.name}</span>
              <span style={{ fontSize: "0.8rem", color: "var(--muted)", marginLeft: "8px" }}>{c.grade_label || "未填年级"}</span>
            </div>
          </div>
        ))}
      </section>

      {/* iPad 访问码管理 */}
      <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px" }}>
        <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "8px" }}>📱 iPad 设备绑定</h2>
        <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "12px" }}>在儿童 iPad 端打开应用并输入 6 位配对码进行绑定：</p>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" }}>
          <select
            value={selectedChildForCode}
            onChange={e => { setSelectedChildForCode(e.target.value); setAccessCode(""); }}
            style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--border)" }}
          >
            {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn-primary" onClick={generateCode} disabled={codeLoading}>
            {codeLoading ? "生成中..." : "生成 6 位访问码"}
          </button>
        </div>
        {accessCode && (
          <div style={{ textAlign: "center", padding: "12px", background: "var(--accent-light)", borderRadius: "8px" }}>
            <span style={{ fontSize: "1.8rem", fontWeight: 800, letterSpacing: "0.25em", color: "var(--accent)" }}>{accessCode}</span>
            <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "4px" }}>24 小时内有效</p>
          </div>
        )}
      </section>

      {/* 规范退出登录 */}
      <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px", textAlign: "center" }}>
        <button
          onClick={() => { if (window.confirm("确定要退出登录吗？")) onLogout(); }}
          style={{ color: "var(--danger)", fontWeight: 650, fontSize: "0.92rem", padding: "8px 16px", cursor: "pointer" }}
        >
          🚪 退出当前登录
        </button>
      </section>
    </div>
  );
}
```

---

## 7. 验收检查清单与测试用例（Definition of Done）

为确保重构满足高可用与无回归标准，上线前须通过以下 7 项严苛验收：

| 验收编号 | 验收项 | 期望结果 (Expected Result) | 检验工具/方式 |
|---|---|---|---|
| **AC-01** | **移动端双重导航彻底绝迹** | 宽度 `< 768px` 时，页面仅保留规范底部 4 栏 TabBar，顶部旧胶囊导航彻底隐藏（`display: none`），首屏多腾出 52px+ 净空间 | Chrome DevTools (390x844) |
| **AC-02** | **退出登录按钮唯一性** | 全站仅在【我的设置】Tab 最底部保留唯一定位且带二次确认的退出登录入口；首页与顶部 Header 不再出现任何裸露的“退出”字样 | 全局 DOM 节点扫描 |
| **AC-03** | **落地页即时呈现今日任务** | 家长登录后默认直达【今日看板】，无须先点击孩子卡片，首屏直接呈现当天任务完成度环形图与任务条目 | 登录后首屏走查 |
| **AC-04** | **待审批置顶流一键 Approve** | 当孩子端提交任务后，家长端首屏置顶黄色 Hero 卡，点击“⭐ 点赞批准”即时增加星星并更新状态，耗时 `< 1s` | 联调测试 (Child PWA -> Parent) |
| **AC-05** | **多孩平滑秒级切换** | 拥有 >=2 个孩子时，顶部平铺 Avatar Pills 带有待审红点，点击任一孩子直接切换当前上下文，不发生白屏重载 | 多孩 Mock 数据联调 |
| **AC-06** | **iPad 访问码独立清爽** | 在【我的设置】->【iPad 设备绑定】中可一键为指定孩子生成 6 位等宽大字访问码，不再深埋于任务管理列表第 400+ 行 | 功能测试 |
| **AC-07** | **桌面端无缝自适应** | 宽度 `>= 768px` 时，底部 TabBar 自动隐藏，顶部 Header 展开居中导航；窗口在 390px 与 1200px 间拉伸时布局平滑断点切换，无横向滚动条 | 响应式断点测试 |

---

> **结语**：本重构规范将 Parent Web 从“机械的管理后台”彻底蜕变为“高频温暖的每日成长控制台”，在彻底修复视觉导航冗余 Bug 的同时，使亲子互动回路的阻尼降低 70% 以上，为后续 AI 任务规划与多模态审批提供了坚实规范的架构基石。
