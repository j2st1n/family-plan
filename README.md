# Family Plan

家长安排计划，孩子在 iPad 上查看并完成任务的亲子计划系统。

[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/j2st1n/family-plan)](https://github.com/j2st1n/family-plan/tags)

## 功能

- 📋 **当日任务** — 家长按天制定，孩子看到清晰卡片列表
- 🔁 **重复任务** — 每周固定项（弹吉他二四、书法二三六），自动生成
- ⭐ **星星奖励** — 完成得星，连续打卡，难度越高星星越多
- 👶 **孩子自建** — 孩子在 iPad 上也能添加任务，家长确认后生效
- ✅ **认可流程** — 孩子创建 → 家长审核通过 → 可完成获得奖励
- 📅 **时间安排** — 定时任务在上，自由任务在下，孩子可自行排时间
- 📱 **iPad 适配** — PWA 全屏，横竖屏自适应，安全区适配
- 🖼️ **任务分享图片** — 家长按所选日期生成任务与完成情况图片，预览、保存或系统分享
- 👥 **双角色** — 家长 JWT 管理 + 孩子设备 token 免登录
- 🐳 **Docker 一键部署** — `docker compose up -d`
- 🔒 **本地优先** — 默认仅绑定 127.0.0.1

## 快速开始

```bash
# 1. 下载 docker-compose.yml
curl -O https://raw.githubusercontent.com/j2st1n/family-plan/master/docker-compose.yml

# 2. 设置 JWT_SECRET（必须）
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env

# 3. 启动
docker compose up -d

# 4. 检查运行状态
curl http://127.0.0.1:8000/health
```

前端开发模式下启动：

```bash
# 家长管理端
cd src/parent-web && npx vite
# → http://127.0.0.1:5174

# 孩子 iPad 端
cd src/child-pwa && npx vite
# → http://127.0.0.1:5173
```

## 使用流程

1. 家长打开管理端 → 注册/登录 → 添加孩子 → 点击孩子卡片
2. 在当日任务面板添加任务（名称、时长、难度、时间段）
3. 或添加重复任务（每周几、星星数）
4. 生成访问码 → 孩子在 iPad 打开 PWA → 输入码绑定
5. 孩子看到今日任务 → 完成 → 得星 → 打卡更新
6. 家长看到完成状态 → 可调整星星数 → 认可孩子自建任务

## 配置

```bash
cp .env.example .env
# 生产部署必须设置 JWT_SECRET
```

环境变量：

| 变量 | 说明 | 默认值 |
|---|---|---|
| `DATABASE_URL` | 数据库连接串 | docker 内自动 |
| `JWT_SECRET` | JWT 签名密钥 | **无默认值，生产必须设置** |

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | FastAPI + SQLAlchemy + PostgreSQL |
| 家长端 | React + Vite |
| 孩子端 | React + Vite (PWA) |
| 部署 | Docker Compose |

## 目录结构

```
src/backend/        FastAPI 后端 (models, routes, services)
src/parent-web/     家长 Web 管理端
src/child-pwa/      孩子 iPad PWA
docs/               产品/架构/API 文档
infra/              独立 PostgreSQL 开发服务
scripts/            发布脚本
```

## 开发

```bash
# 后端
cd src/backend
uv venv && uv pip install -e .
uv run uvicorn app.main:app --reload

# 家长 Web
cd src/parent-web
npm install && npx vite

# 孩子 PWA
cd src/child-pwa
npm install && npx vite
```

## 安全

- 生产环境必须设置强随机 `JWT_SECRET`
- 默认端口仅绑定 `127.0.0.1`，不暴露公网
- 孩子端免密码，通过家长生成的一次性访问码绑定设备
- 数据库密码默认仅本地开发用，生产需更换

## 文档

当日任务按孩子汇总多个计划，编辑、删除和认可会使用每条任务自身的计划 ID。删除仅影响该日实例，重复任务次日仍正常生成；已完成任务保持只读，避免改动既有奖励记录。操作失败时管理页面会显示具体错误。

查看过去日期不会补生成重复任务。连续打卡计算历史完成率时，只统计在任务日期结束前已创建、家长已认可且未删除的任务；旧版历史查询事后补生成的实例仍可查看，但不会再把休息日变成漏打日或拉低历史完成率。当前生产沿用 UTC 日期，已经结束的任务日未达标仍会中断；历史补生成防护本身不强制恢复连续天数或改动奖励记录。

删除会影响达标率的任务时，连续天数会根据剩余可核实记录重算；历史最长天数和奖励流水保留，没有任务的日期跳过，当天尚未达标也不会提前打断昨天的连续。仍有历史未达标日期时，连续不会跨过该日期。日期选择框保留有效日期，不会因清空中间状态发出空日期请求；加载成功会清除之前的加载错误。

家长进入孩子的任务页，选择日期后点击“分享图片”。图片包含该日全部可见任务（包括折叠的已完成项）、每项状态、预计时长、时间安排、认可任务完成率和已完成任务奖励，不使用当前累计星星或连续天数冒充历史数据。未认可任务单独标注，不计入完成率；长列表自动分图。可选择标题是否显示姓名，保存 PNG，或在浏览器支持文件分享时打开系统分享。图片由浏览器本地生成；不支持系统分享时仍可保存或长按图片。

孩子端在“今日任务”页点击“分享图片”，使用任务接口返回日期及生成时的任务状态，包含折叠的完成项；可关闭“标题显示我的姓名”、保存或调用系统分享。任务操作和重新读取期间不能新生成，读取失败后须先重试；已打开的图片预览保持原快照并标明生成时间，不被后台加载打断。两端共用 `src/shared-web/` 中的预览与绘图组件，图片在设备本地生成。

## 回归验证

在独立开发数据库完成迁移后运行 `cd src/backend && uv run pytest`，不要将测试数据库连接指向生产。测试覆盖多计划任务管理、删除后刷新、家长权限、重复任务、事件流心跳以及既有 bcrypt 密码兼容性。

浏览器回归可运行 `FAMILY_PLAN_TEST_URL=http://mom.localhost:18001 node scripts/test-task-management.mjs`。该命令会在指定环境创建测试账户和任务，仅用于隔离测试环境。

日期防护可运行 `node scripts/test-date-input.mjs`；真实 Chrome 的合成界面回归运行 `node scripts/test-date-browser.mjs`，覆盖清空日期、错误恢复和迟到响应，不访问生产或创建真实账户。

分享图片验证运行 `node scripts/test-task-share-model.mjs` 和 `node scripts/test-task-share-browser.mjs`。浏览器回归使用合成任务及模拟系统分享，覆盖实际 PNG 下载、选中日期与失败保护、统计、姓名选项、空日、分页、手机布局和资源释放，不向真实联系人发送内容。

孩子端分享验证运行 `node scripts/test-child-share-model.mjs` 和 `node scripts/test-child-share-browser.mjs`。全部使用本机合成任务，覆盖接口日期/姓名、快照白名单、实际PNG、完成/新增/修改/删除/安排时间期间保护、失败恢复、迟到响应、预览稳定、手机布局、空日、分页及URL释放。系统分享只模拟，不向真实联系人发送文件。

孩子端正式构建后运行 `node scripts/test-child-share-production.mjs`，以完整 App 和 StrictMode 验证构建产物的真实 PNG、任务操作失败及重试、401 解绑后预览/凭据/URL 清理；同样只使用本机合成接口。

家长页首次打开或切换任务日期显示加载提示，同日后台同步保留列表与编辑表单。离开页面不足 5 秒不因焦点切换补拉，较长离开后合并可见性与焦点事件；SSE 心跳不触发查询，断线或延迟连接后仍会静默补拉。只复用在事件之后开始的成功或进行中的读取，其余触发合并为后续读取，避免覆盖期间的新变化丢失。刷新回归运行 `node scripts/test-refresh-queue.mjs` 与 `node scripts/test-refresh-browser.mjs`，全部使用本机合成数据。

真实心跳验收可运行 `FAMILY_PLAN_TEST_URL=http://mom.localhost:18001 node scripts/test-event-stream.mjs`，在两次 25 秒空闲心跳后创建测试任务并确认仍收到事件。

## 文档链接

- [PRD](docs/prd.md)
- [架构](docs/architecture.md)
- [数据模型](docs/data-model.md)
- [API 接口](docs/api.md)
- [实施计划](docs/implementation-plan.md)

## License

MIT
