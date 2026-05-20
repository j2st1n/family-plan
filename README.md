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

- [PRD](docs/prd.md)
- [架构](docs/architecture.md)
- [数据模型](docs/data-model.md)
- [API 接口](docs/api.md)
- [实施计划](docs/implementation-plan.md)

## License

MIT
