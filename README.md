# Family Plan 👨‍👩‍👧‍👦

> **现代亲子自律与习惯养成系统**。家长制定计划与任务，孩子在 iPad / 手机端打卡、专注计时、赚取星星并在心愿商城兑换奖励。
>
> 专为家庭自托管打造，遵循 **Apple iOS Human Interface Guidelines (HIG)**，纯净无广告、安全本地优先、支持 AI 智能 Copilot 辅助与高分辨率自律成就海报分享。

[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Design: Apple HIG](https://img.shields.io/badge/design-Apple%20iOS%20HIG-blue)](https://developer.apple.com/design/human-interface-guidelines)
[![GitHub Repo](https://img.shields.io/badge/GitHub-j2st1n%2Ffamily--plan-181717?logo=github)](https://github.com/j2st1n/family-plan)

---

## ✨ 核心特性

### 1. 纯正 Apple iOS HIG 设计美学
- **系统级原生质感**：采用苹果经典设计规范（SF 风格矢量图标、动态模糊磨砂玻璃、标准 Inset Grouped TableView 卡片与圆角规范）。
- **全端原生模态抽屉（Bottom Sheet）**：弹窗与设置全面采用 iOS 原生底部浮层设计，支持手势下拉与流畅回弹。
- **iOS Safari 软键盘自适应**：通过 `window.visualViewport` 动态监听软键盘弹起高度，抽屉内容自动托举，坚决杜绝移动端表单输入被虚拟键盘遮挡。
- **全屏与大屏响应式人机工程学**：手机端饱满触控，iPad / 平板 / 电脑端优雅自适应包裹与右对齐，彻底消除边缘“大劈叉”拉伸。

### 2. 双端协同与亲子闭环交互
- **家长端 (Parent Web)**：
  - **4 栏极简架构**：`今天`、`成长统计`、`星星商城`、`设置`。
  - **每日概览与点赞审核**：实时掌控孩子当日任务达成率（Activity Ring 环形圈）、累计连胜勋章与累计星池；支持一键点赞发星、驳回或撤回。
  - **心愿审批与上架**：家长自主配置兑换商品，自定义单价与限购，审核孩子的心愿兑换。
  - **休假模式与连击保护**：支持配置灵活的休假日期与断签补签机制，保护孩子的自律积极性。
- **儿童端 (Child PWA)**：
  - **沉浸式打卡体验**：极简大字卡片、顺畅的滑动手势与完成触控反馈。
  - **专注番茄钟 (Focus Timer)**：沉浸式专注倒计时圆环，支持锁屏唤醒维持（WakeLock）与翻页自适应。
  - **心愿许愿与星星商城**：用自律挣来的星星兑换心仪的礼物或特权。

### 3. AI 智能任务助手 (AI Copilot)
- **自然语言一键建任务**：输入日常口语（如 *“每天早上 8 点练琴 20 分钟奖励 2 星”*），AI 自动解析拆解为任务名称、时长、时间段、难度与星星奖励。
- **多模型生态支持**：内置主流大模型预设（DeepSeek、OpenAI、本地 Ollama 及自定义端点），支持一键远程拉取可用模型列表。
- **服务端凭证加密**：API Key 采用 **AES-256-GCM** 服务端安全派生密钥加密持久化，接口输出严格脱敏，不存明文凭证。
- **离线降级熔断保护**：模型网络异常或响应超时自动无缝回退至本地启发式规则，提供基础任务解析；其他业务操作仍需要联网。

### 4. 2x Retina 自律成长成就海报分享
- **纯前端矢量 Canvas 实时绘制**：无须后端渲染或外部网络图片依赖，零跨域污染（CORS Taint），高分屏与微信朋友圈字迹锐利如刀。
- **清晰严谨的信息架构**：严格区分【当日完成/奖励】与【长期累计连胜/总星池】，动态根据任务数自适应高度，消灭空洞留白。
- **系统级 Web Share API 联动**：移动端直接调起 iOS / Android 原生分享面板，并支持 1:1 并排保存卡片至本地相册。

---

## 🏗️ 架构与技术栈

| 模块 | 核心技术选型 | 说明 |
| :--- | :--- | :--- |
| **后端 API** | FastAPI + SQLAlchemy 2.0 + PostgreSQL | 高性能异步 API，Alembic 自动迁移，AES-256-GCM 加密库 |
| **家长管理端** | React 19 + Vite + Apple HIG Design Tokens | 响应式 PWA/Web，模块化 Inset Grouped 抽屉架构 |
| **孩子 iPad/手机端** | React 19 + Vite + 移动端 Web | 免密码 Token 绑定，支持添加到主屏幕；任务读写需要联网 |
| **反向代理与 TLS** | Caddy v2 (或 Nginx) | 自动 HTTPS，反代至本地 127.0.0.1 端口 |
| **容器化交付** | Docker + Docker Compose | 多阶段极小体积镜像打包，健康检查开箱即用 |

---

## 🚀 快速开始

### 方式一：Docker Compose 一键部署（推荐）

1. **克隆代码库**：
   ```bash
   git clone https://github.com/j2st1n/family-plan.git
   cd family-plan
   ```

2. **配置环境变量**：
   ```bash
   cp .env.example .env
   # 生成随机密钥，将输出填入 .env 的 JWT_SECRET，替换 change-me-in-production
   openssl rand -hex 32
   ```

3. **启动容器服务**：
   ```bash
   # 从当前检出源码构建；仓库合并不会自动更新 GHCR 的 latest
   docker build -t family-plan:local .
   FAMILY_PLAN_IMAGE=family-plan:local docker compose up -d
   ```

4. **验证健康状态**：
   ```bash
   curl http://127.0.0.1:8000/health
   # 返回 status=ok；version 以当前构建为准
   ```

---

### 方式二：本地研发模式启动

#### 1. 后端研发环境
```bash
cd src/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### 2. 前端开发环境
```bash
# 家长 Web 端
cd src/parent-web
npm install
npm run dev
# 默认端口: http://127.0.0.1:5174

# 孩子 PWA 端
cd src/child-pwa
npm install
npm run dev
# 默认端口: http://127.0.0.1:5173
```

#### 3. 运行全站自动化测试
```bash
npm --prefix src/parent-web test
npm --prefix src/child-pwa test
pytest src/backend/tests
```

---

## 🔒 安全与隐私

- **网络隔离原则**：默认所有服务仅绑定宿主机 `127.0.0.1` 环回接口，不直接向公网暴露端口；生产环境建议通过反向代理（Caddy / Nginx）开启 TLS 访问。
- **免密码安全绑定**：孩子端无需记忆复杂密码，通过家长端生成的唯一一次性绑定 Token 接入，并随时支持在后台吊销。
- **秘钥加密存储**：大语言模型 API Key 在服务端经 AES-256-GCM 算法加密，API 接口统一掩码（如 `sk-****3a8f`）。

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 协议开源。
