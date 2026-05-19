# Family Plan 项目审计报告

审计路径：`/home/j2/projects/family-plan`

审计范围：项目设计、架构、代码安全、部署配置、数据一致性、工程质量。

审计方式：只读检查。未修改业务代码。

## 一句话结论

这个项目当前是一个结构清晰、适合 MVP 的亲子任务系统：后端 FastAPI + SQLAlchemy + PostgreSQL，前端 React/Vite 分为家长端和孩子 PWA，部署走 Docker Compose。但如果要真正生产使用，最需要优先补的是 **认证安全、访问码防爆破、奖励发放幂等、并发一致性、生产部署配置**。目前最大风险不是代码写得乱，而是 MVP 阶段常见的“默认配置 + 缺少限流 + 并发场景未收口”。

## 检查内容

- 项目结构、README、Dockerfile、docker-compose、Caddyfile
- 后端 FastAPI 路由、services、schemas、models、Alembic 迁移
- 家长端 React/Vite 代码
- 孩子端 PWA 代码
- Git 状态和近期提交
- 前端生产构建
- npm production dependency audit

验证结果：

- Git 当前分支：`master`
- 当前提交附近：`97a649a chore: bump version to 0.1.4`
- 后端 Python 语法编译：通过
- 家长端 `npm run build`：通过
- 孩子端 `npm run build`：通过
- `npm audit --omit=dev`：家长端/孩子端均无生产依赖漏洞
- 仓库没有测试文件
- `pygount` 未安装，所以使用脚本做了基础规模统计

代码规模粗略统计，不含 `.git`、`node_modules`、`dist` 等：

- Python：50 文件，约 2085 行
- JSX：10 文件，约 833 行
- JS：4 文件，约 247 行
- Markdown：10 文件，约 961 行
- JSON：6 文件，约 3651 行
- 总计：102 个文本文件，约 8355 行

---

## P0：必须优先处理的问题

### 1. 生产默认 JWT 密钥和数据库密码过弱，容易被误用上线

相关位置：

- `docker-compose.yml:14-15`
- `src/backend/app/core/config.py:8-9`
- `src/backend/app/core/security.py:21-28`

现状：

- `docker-compose.yml` 里数据库账号密码默认是 `family_plan:family_plan`
- `JWT_SECRET` 默认回落到 `family-plan-dev`
- `config.py` 中 `jwt_secret` 默认空字符串
- `security.py` 直接用 `settings.jwt_secret` 签发和校验 JWT，没有启动时强校验

风险：

- 如果生产部署忘记设置 `JWT_SECRET`，任何知道默认密钥的人都可能伪造家长 token。
- 数据库密码也属于公开可猜的弱默认。

建议：

- 应用启动时强制校验：
  - `JWT_SECRET` 必须存在
  - 长度至少 32 字节以上
  - 不能是 `family-plan-dev`、`change-me-in-production`、空字符串
- 生产 compose 不要给 `JWT_SECRET` 默认值。
- 数据库密码通过 `.env` 或 secret 注入，不要在生产模板中写死弱密码。
- 对外提供 `docker-compose.example.yml`，真实生产配置要求用户显式填写。

### 2. 登录、注册、孩子设备绑定无速率限制，可被暴力破解

相关位置：

- `src/backend/app/routes/auth.py:11-20`
- `src/backend/app/routes/devices.py:12-15`
- `src/backend/app/services/access_codes.py:29`
- `src/backend/app/services/devices.py:13-23`

现状：

- `/auth/login`、`/auth/register` 没有限流
- `/child-devices/bind` 无认证、无限流
- 孩子访问码只有 6 位数字
- 绑定失败没有计数、没有 IP 限流、没有验证码冻结

风险：

- 6 位数字码在线爆破成本低。
- 登录接口可被撞库或密码喷洒。

建议：

- 加全局限流中间件，例如 SlowAPI、Redis rate limit，或反代层限流。
- 登录限流维度：
  - IP
  - username
  - IP + username
- 访问码绑定限流维度：
  - IP
  - code hash
  - display/device fingerprint
- 访问码连续失败 N 次后冻结短时间。
- 访问码可以从 6 位数字升级为：
  - 8 位数字
  - 或短码 + code_id
  - 或一次性深链接 token

### 3. 任务完成和奖励发放存在并发竞态，可能重复发星星

相关位置：

- `src/backend/app/services/daily_tasks.py:53-96`
- `src/backend/app/models/reward_ledger.py`
- `src/backend/app/models/daily_task.py`

现状：

`complete_task()` 的流程是：

- 查询任务
- 判断 `status == pending`
- 设置 completed
- 插入 `RewardLedger`
- commit

但没有行锁，也没有条件更新，也没有奖励流水唯一约束。

风险：

- 孩子端双击、网络重试、并发请求时，两个事务可能同时看到任务还是 pending，然后各自插入一条奖励流水。
- 结果是同一个任务重复发星星。

建议：

- 用条件更新保证原子性：
  - `UPDATE daily_tasks SET status='completed' WHERE id=:id AND child_id=:child_id AND status='pending'`
  - 检查 affected rows 是否为 1
- 或者对任务行 `SELECT ... FOR UPDATE`
- 给 `reward_ledger` 增加唯一约束：
  - `(source_type, source_id)`
- 将任务状态变更、奖励流水、streak 更新放在一个事务里。

### 4. 孩子可完成未获家长批准的自建任务并拿奖励

相关位置：

- `src/backend/app/services/daily_tasks.py:231-245`
- `src/backend/app/services/daily_tasks.py:53-77`

现状：

- 孩子创建任务时：
  - `created_by="child"`
  - `approved=False`
  - `reward_stars` 由孩子传入
- 但完成任务时只检查：
  - task belongs to child
  - status is pending
- 没有检查 `approved`

风险：

- 孩子可以自己创建一个任务，立刻完成，然后拿星星。
- 这绕过了“家长认可流程”。

建议：

- 未批准任务不可完成，或者完成不发奖励。
- 更好的模型：
  - 孩子创建的是 `suggested_task`
  - 家长批准后转成正式 `daily_task`
  - 奖励星星由家长批准时决定
- 如果产品希望孩子也能自驱完成任务，那也应该区分：
  - 自驱完成记录
  - 计入奖励的正式任务

---

## P1：高优先级优化

### 5. 访问码哈希使用无盐 SHA-256，数据库泄露后可被离线枚举

相关位置：

- `src/backend/app/core/security.py:13-14`
- `src/backend/app/services/access_codes.py:29-32`
- `src/backend/app/models/child_access_code.py:15`

现状：

- 6 位访问码通过 `sha256(code)` 存储
- 没有 salt、pepper、HMAC

风险：

- 如果数据库泄露，攻击者可以瞬间枚举 `000000` 到 `999999`，还原所有访问码 hash。
- 虽然 TTL 只有 15 分钟，但历史数据和窗口期仍有风险。

建议：

- 使用 `HMAC(server_secret, code + code_id)`。
- 存储 `code_id`，查询时先定位 code_id 再验证 code。
- 或者访问码仍为 6 位，但服务端增加 pepper。
- 定期清理过期访问码。
- 失败计数和冻结机制要一起做。

### 6. 孩子设备 token 永不过期，缺少撤销/设备管理入口

相关位置：

- `src/backend/app/core/security.py:17-18`
- `src/backend/app/core/deps.py:34-53`
- `src/backend/app/models/child_device.py:17-19`
- `src/backend/app/routes/devices.py`

现状：

- 设备 token 生成后长期有效
- `ChildDevice` 有 `last_seen_at` 和 `revoked_at`
- 但目前没有家长查看设备、撤销设备的 API
- `get_current_child()` 也没有更新 `last_seen_at`

风险：

- iPad 丢失、token 泄露、本地存储被读取后，设备长期有效。
- 家长没有下线设备能力。

建议：

- 增加家长端设备管理：
  - 列出 child devices
  - 显示 display_name、created_at、last_seen_at
  - revoke device
- `get_current_child()` 每隔一定时间更新 `last_seen_at`
- 支持 token 轮换
- 可以设置长期过期时间，例如 30/90 天后需要重新绑定

### 7. 父/子 token 都存 localStorage，XSS 后可直接接管

相关位置：

- `src/parent-web/src/pages/Login.jsx:16-18`
- `src/child-pwa/src/api.js:3-9`

现状：

- 家长 token 存在 `localStorage.parent_token`
- 孩子 token 存在 `localStorage.device_token`
- 请求时作为 Bearer token 发送

风险：

- 任一 XSS、恶意浏览器扩展、供应链脚本都可读取 token。
- 家长 token 7 天有效，孩子 token 目前长期有效。

建议：

家长端：

- 优先改为 HttpOnly + Secure + SameSite cookie
- access token 短有效期
- refresh token 服务端可撤销

孩子端：

- PWA 如果必须 localStorage，要配合：
  - token 可撤销
  - token 低权限
  - token 定期轮换
  - CSP 降低 XSS 风险

反代层增加安全头：

- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`

### 8. CORS 写死 localhost，生产配置不可环境化

相关位置：

- `src/backend/app/main.py:15-20`

现状：

- 只允许：
  - `http://127.0.0.1:5173`
  - `http://localhost:5173`
  - `http://127.0.0.1:5174`
  - `http://localhost:5174`
- `allow_credentials=True`
- methods/headers 全开放

风险：

- 生产域名调用可能失败。
- 后续如果为了省事改成 `*`，配合 credentials 会引入风险。

建议：

- 将 CORS origins 做成环境变量：
  - `CORS_ORIGINS=https://kids.example.com,https://mom.example.com`
- 生产只允许实际域名。
- 不要用 `*` 配合 credentials。
- 如果所有前端和 API 同源，甚至可以生产关闭 CORS。

### 9. 生产镜像不会自动执行数据库迁移

相关位置：

- `Dockerfile:37`
- `docker-compose.yml`
- `src/backend/alembic/`

现状：

- 容器启动只执行：
  - copy static
  - uvicorn
- 没有 `alembic upgrade head`
- compose 只等数据库 healthy

风险：

- 新环境或升级后 schema 不匹配，接口可能 500。
- 部署流程不可重复。

建议：

- 增加独立 migration job：
  - `docker compose run --rm api alembic upgrade head`
- 或 compose 增加一次性 `migrate` service。
- API 启动时检查 alembic version，不建议静默自动改库。
- CI 中加入迁移验证。

### 10. 每日任务自动生成存在并发重复/冲突风险

相关位置：

- `src/backend/app/services/daily_tasks.py:176-228`
- `src/backend/app/models/daily_task.py:38-39`

现状：

- 先查已有 `task_template_id`
- 再插入新 daily task
- 没有 upsert、锁、IntegrityError 处理
- 唯一约束 `(child_id, task_date, task_template_id)` 对模板任务有帮助，但并发下仍可能抛错
- PostgreSQL 中 `task_template_id = NULL` 的手工任务不会被这个唯一约束去重

风险：

- 孩子端和家长端同时拉取当天任务时可能重复生成或触发 500。
- GET 查询有副作用，更容易放大并发问题。

建议：

- 对模板任务用 `INSERT ... ON CONFLICT DO NOTHING`
- 或捕获唯一冲突后重新查询
- 将“生成任务”和“查询任务”拆开
- 明确手工任务是否允许重复；如果不允许，增加业务约束或幂等 key

---

## P2：中优先级优化

### 11. `list_tasks_for_date()` 逻辑可疑：先查再无条件生成

相关位置：

- `src/backend/app/services/daily_tasks.py:131-140`

现状：

```python
dailies = list(...)
dailies = _generate_tasks_for_date(...)
return dailies
```

第一次查询结果被直接覆盖。

风险：

- GET 请求无条件触发生成逻辑。
- 副作用不明显，不利于缓存、审计和测试。
- 并发时更容易触发重复插入。

建议：

- 如果目标是“查询某日任务，若没有则生成”，应该写清楚：
  - 先查
  - 无数据才生成
  - 再查返回
- 或者拆成：
  - `GET /daily-tasks`
  - `POST /daily-tasks/generate`

### 12. 模板更新/删除会删除今天及未来任务，可能误删当天数据

相关位置：

- `src/backend/app/services/plans.py:126-133`
- `src/backend/app/services/plans.py:141-149`

现状：

- 更新模板后删除 `task_date >= today` 的 DailyTask
- 删除模板也删除今天及未来任务
- 没有排除已完成任务

风险：

- 今天孩子已经安排但未完成的任务会被抹掉。
- 今天已经完成的任务也可能被删，影响奖励、审计和回顾。
- 家长手动调整的当天计划可能丢失。

建议：

- 只删除未来未完成、且由模板生成的任务。
- 已完成任务只保留历史，不再受模板影响。
- 更好的方式是模板版本化：
  - 新模板版本影响未来
  - 历史 daily task 保持快照

### 13. 日期/时区混用，跨午夜容易错日

相关位置：

- `src/backend/app/services/daily_tasks.py:35-40`
- `src/backend/app/services/daily_tasks.py:80`
- `src/backend/app/services/daily_tasks.py:99-104`
- `src/backend/app/routes/daily_tasks.py:60-62`

现状：

- 任务日期用 `date.today()`
- 完成时间用 `datetime.now(UTC)`
- 没有统一业务时区

风险：

- 服务器时区、用户所在地、UTC 日期不一致时，孩子看到的“今天”和系统奖励 streak 可能错位。
- 如果部署在 UTC 服务器，中国家庭晚上/早上跨日时尤其容易出问题。

建议：

- 增加配置：`BUSINESS_TIMEZONE=Asia/Shanghai`
- 所有业务“今天”通过统一函数计算：
  - `today_in_business_tz()`
- 测试跨午夜场景：
  - 23:59
  - 00:01
  - UTC 日期和北京时间日期不同

### 14. 时间字段用裸字符串，非法输入可能触发 500

相关位置：

- `src/backend/app/schemas/daily_task.py:63-64`
- `src/backend/app/schemas/daily_task.py:83-89`
- `src/backend/app/services/daily_tasks.py:301-304`

现状：

- `scheduled_start` / `scheduled_end` 是 `str`
- service 层直接 `time.fromisoformat(value)`
- 没有捕获异常
- 没有校验 end > start

风险：

- 非法时间字符串可能触发未处理异常。
- 结束时间早于开始时间也会被接受。

建议：

- schema 层使用 `datetime.time`
- 或 Pydantic validator 统一校验：
  - 格式 `HH:MM`
  - end > start
  - 是否允许跨午夜
- 错误应返回 422，而不是 500。

### 15. 业务字段缺少数据库级约束

相关位置：

- `src/backend/app/models/daily_task.py`
- `src/backend/app/models/plan.py`
- `src/backend/app/models/task_template.py`
- `src/backend/app/schemas/plan.py`

现状：

- `status`、`created_by`、`schedule_by` 等是裸字符串
- `reward_stars` 在不同 schema 上限不一致
- `weekdays` 没有约束必须为 1-7

风险：

- 脚本、迁移、未来接口可以写入非法状态。
- 计划生成逻辑可能遇到异常数据。

建议：

- 数据库层增加 CHECK 约束：
  - `status in (...)`
  - `created_by in ('parent','child')`
  - `reward_stars between 0 and 5`
  - weekdays 每项 1..7
- Python 层用 Enum 替代裸字符串。
- schema 和模型约束保持一致。

### 16. 注册存在唯一约束竞态，可能返回 500

相关位置：

- `src/backend/app/services/auth.py:10-18`
- `src/backend/app/models/parent.py:15`

现状：

- 先查询 username 是否存在
- 再插入
- 没有捕获 `IntegrityError`

风险：

- 两个同名注册并发时，一个会触发数据库唯一约束异常，可能返回 500。

建议：

- 捕获 `IntegrityError` 并返回 409。
- 或者使用数据库 upsert。
- 登录/注册相关错误统一返回，避免暴露过多信息。

---

## P3：架构和工程质量建议

### 17. 缺少测试体系

现状：

- 仓库没有 `test_*`、`*.test.*`、`*.spec.*`
- CI 主要做 Docker build 和 health check
- 没有后端单元测试、API 测试、迁移测试、前端组件测试

建议优先补这些测试：

- 后端 API 测试：
  - 注册/登录
  - 创建孩子
  - 生成访问码
  - 绑定设备
  - 孩子今日任务
  - 完成任务发奖励
  - 未批准任务不可发奖励
- 并发测试：
  - 同一任务双击完成，只发一次奖励
  - 同一天模板任务并发生成，不重复
- 权限测试：
  - 家长 A 不能访问家长 B 的孩子/计划
  - 孩子 token 不能访问家长 API
- 迁移测试：
  - 空库 `alembic upgrade head`
  - 旧版本升级到新版本

### 18. CI/CD 使用 `latest`，生产不可复现

相关位置：

- `.github/workflows/docker.yml:39-41`
- `docker-compose.yml:3`

现状：

- CI 推 `latest` 和版本 tag
- compose 使用 `ghcr.io/j2st1n/family-plan:latest`

风险：

- 重启或拉取时可能拿到非预期版本。
- 回滚困难。

建议：

- 生产 compose 使用固定 tag，例如 `v0.1.4`
- 更严格可用 digest：
  - `image: ghcr.io/j2st1n/family-plan@sha256:...`
- `latest` 仅用于开发环境。

### 19. 静态资源部署路径不清晰

相关位置：

- `Dockerfile:21-22`
- `Dockerfile:37`
- `docker-compose.yml:8-9`
- `src/backend/app/main.py`

现状：

- Dockerfile 构建了 parent/child 静态资源
- compose 又挂载 `./dist:/app/static`
- CMD 启动时复制 `/app/static-built/*` 到 `/app/static`
- 但 FastAPI 没有挂载 `StaticFiles`
- Caddyfile 又配置了 `/opt/family-plan/dist/child` 和 `/opt/family-plan/dist/parent`

风险：

- 到底谁服务前端不够明确。
- `/app/static` 可能根本没被 FastAPI 用到。
- 启动时 copy 到 bind mount 可能留下旧文件或权限问题。

建议二选一：

方案 A：API 只负责 API，前端由 Caddy/Nginx 服务

- 删除 API 容器内静态复制逻辑
- 部署流程明确把 dist 同步到 `/opt/family-plan/dist`
- Caddy 负责 SPA fallback

方案 B：FastAPI 同时服务前端

- 在 `main.py` 显式 `mount StaticFiles`
- 配 SPA fallback
- 不再依赖宿主机 `./dist` bind mount

更建议方案 A，边界更干净。

### 20. Caddy 缺少安全响应头

相关位置：

- `Caddyfile.prod`

建议增加：

- HSTS
- CSP
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`

尤其因为当前 token 存在 localStorage，CSP 的价值更高。

### 21. 后端代码有一些整理问题

例子：

- `src/backend/app/routes/daily_tasks.py:27-41` 有重复导入
- 部分路由函数没有 response_model
- service 层有较多 commit，事务边界分散
- `_get_child_plan()` 放在 routes 文件里，且内部局部 import model/error，建议下沉到 service

建议：

- 引入 `ruff`
- CI 中跑：
  - `ruff check`
  - `pyright`
  - `python -m pytest`
- service 层统一事务管理，不要一个业务流程多次 commit。
- 路由层只做参数、权限、response model，业务逻辑放 service。

---

## 架构建议：下一阶段可以这样演进

### 后端分层

当前已经有：

- routes
- services
- models
- schemas

建议继续强化：

- routes：只做 HTTP 输入输出
- services：业务流程
- repositories：复杂查询和持久化
- domain：奖励、streak、任务生成规则
- security：认证、授权、token、访问码

尤其是奖励和任务生成，已经是核心领域逻辑，建议不要继续散在 service 里。

### 权限模型

建议明确三类 actor：

- Parent
- ChildDevice
- SystemJob

并明确每类可做什么：

- Parent 可以创建/批准/删除任务、管理设备、调整奖励
- ChildDevice 可以查看当天任务、提交完成、创建“建议任务”
- SystemJob 可以生成重复任务、清理过期访问码

这样以后加审计日志、撤销、通知会容易很多。

### 数据一致性

建议优先建立这些约束：

- `reward_ledger(source_type, source_id)` 唯一
- `daily_tasks(child_id, task_date, task_template_id)` 保留，但生成时用 upsert
- `child_devices(device_token_hash)` 唯一
- `child_access_codes(code_hash)` 如果仍然按 hash 查，应至少考虑 active code 的冲突处理
- `status` 类字段加 CHECK 或 Enum
- `reward_stars` 加范围约束

### 安全路线图

建议按顺序做：

1. 启动时强制校验 `JWT_SECRET`
2. 登录/绑定限流
3. 未批准孩子任务不可发奖励
4. 奖励发放幂等
5. 设备撤销 API
6. CORS 环境化
7. 安全响应头 + CSP
8. localStorage token 迁移或降低风险
9. 访问码 HMAC/pepper
10. 审计日志

---

## 建议的优先级清单

### 立刻做

- 强制生产 `JWT_SECRET`，去掉默认 `family-plan-dev`
- 登录/绑定接口限流
- 完成任务发奖励改成幂等
- 未批准孩子自建任务不能发奖励
- 访问码绑定失败计数/冻结

### 下一轮做

- 设备列表和撤销
- 统一业务时区
- CORS 环境变量
- Alembic migration job
- 时间字段校验
- 奖励流水唯一约束

### 工程化补强

- 后端 pytest API 测试
- 并发测试
- ruff + pyright + CI
- 生产镜像固定 tag
- 明确前端静态资源服务方式
- Caddy 安全头

## 总体评价

这个项目作为 MVP 起点是不错的：

- 代码规模小，结构容易理解
- 前后端职责清楚
- SQLAlchemy model/schema/service 基本分层已经有了
- Docker 构建和前端 build 都能跑通
- npm production audit 没有发现漏洞

但它现在还带着明显 MVP 特征：

- 默认密钥/默认密码风险
- 认证和访问码缺限流
- 奖励和任务生成缺并发幂等
- 生产部署流程不完整
- 测试体系为空

如果目标只是家庭内网自用，风险可控但也建议至少修 P0。

如果要公网部署，P0 和 P1 建议先修完再上线。
