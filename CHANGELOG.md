# Changelog

## [0.3.30] - 2026-10-30

- 孩子端今日任务页增加分享图片，包含已折叠的完成任务、待认可状态、认可完成率和已完成奖励，支持姓名隐藏、PNG保存、系统文件分享及长列表分图。
- 使用今日任务接口的日期与姓名生成白名单快照，不包含设备凭据、访问码或累计余额；加载失败、无效日期及任务操作期间阻止新分享，迟到响应不覆盖新结果，已打开预览不受后台加载影响。
- 提取两端共用的分享组件和绘图工具，保留家长端接口与默认行为，构建配置确保共用组件使用各自应用的 React 实例。
- 增加孩子端快照及真实Chrome合成回归，覆盖实际PNG、五类任务操作、手机布局、失败保护、后台快照、空日和分页；家长端分享、日期和静默刷新回归保持。

## [0.3.29] - 2026-10-30

- 家长任务页同一日期后台同步保留列表与编辑状态，只有首次打开或切换日期显示加载提示；商城同步也保留编辑表单。
- 合并返回前台的 visibility/focus 触发，短暂切换焦点不再重复查询；用事件时点复用已覆盖该事件的请求，其余并发触发排队合并，避免漏掉读取期间发生的新变化。
- 减少 SSE 首连重复读取，保留断线及延迟连接后的静默补拉；切入孩子任务页后首页停止后台查询，过期回调变化不重建连接。
- 增加队列时序和真实 Chrome 合成回归，覆盖编辑框/光标/滚动保留、后台失败重试、事件过滤、慢请求追新、页面激活及既有日期和图片分享行为。

## [0.3.28] - 2026-10-30

- 家长任务页支持按所选日期生成任务分享图片，展示认可任务进度、完成奖励及每项状态、预计时长和安排；已完成折叠项完整出图。
- 支持预览、标题姓名隐藏、PNG 保存和浏览器支持的系统文件分享；长列表完整分图，空任务日也可生成。
- 图片在设备本地绘制，不上传任务内容；禁止用加载失败或上一日期的残留数据生成图片，不混入累计余额、访问码或凭据。
- 将后台静默同步与重复刷新合并记录为后续待办，本轮不调整刷新策略。

## [0.3.27] - 2026-10-29

- 删除有效历史任务后，根据剩余可核实任务原子重算连续天数；已有历史删除也会在读取时校正，保留历史最长记录和奖励流水，不把休息日算成断签。
- 修复日期框清空或输入未完成时请求空日期造成422；成功加载后清除旧错误，忽略先前日期迟到的响应。
- 增加历史删除接续、剩余真实断点、旧删除校正、未达标的今天、无效日期和浏览器错误恢复回归。

## [0.3.26] - 2026-10-29

- 查看历史日期只返回已存在的任务，不再补生成过去的重复任务。
- 连续打卡历史完成率排除任务日期结束后才创建的实例，兼容此前历史查询产生的数据，避免休息日被误判漏打或已达标日期被新增任务拉低完成率。
- 增加历史查询、旧补生成数据、真实漏打和 UTC 日期边界回归；保留当日及未来任务生成、已完成奖励和历史最长记录。

## [0.3.25] - 2026-10-24

- 任务新增和编辑表单明确标注“预计时长”“奖励星星”，时长输入框持续显示“分钟”单位，避免将时长误认作星数。

## [0.3.24] - 2026-10-23

- 修复多计划汇总列表中的任务编辑、删除和认可使用错误计划的问题。
- 删除当日实例后保留删除标记，刷新不再重新生成，次日重复任务保持正常。
- 修复事件流空闲心跳取消订阅，以及任务操作失败缺少错误提示的问题。
- 保留认可任务时的时间与描述，校验非法时间，保护已完成任务和奖励记录。
- 直接使用 bcrypt 验证兼容既有密码，移除 passlib 兼容性告警。
- 补充 API、事件流、密码兼容和浏览器回归，CI 执行后端完整测试。

## [v0.3.23] - 2026-07-13

### Bug Fixes

- preserve streaks on rest days


### Other

- Merge pull request #1 from j2st1n/fix/streak-rest-days


## [v0.3.22] - 2026-06-14

### Bug Fixes

- harden shop isolation and ci smoke


### Maintenance

- bump version to 0.3.22


## [v0.3.21] - 2026-06-06

### Bug Fixes

- bind child dev server to localhost


### Documentation

- document custom reward discount tiers


### Features

- add reward discount tier controls

- allow custom reward discount tiers


### Maintenance

- bump version to 0.3.21


## [v0.3.20] - 2026-05-24

### Bug Fixes

- remove unused cumulative toggle


### Maintenance

- bump version to 0.3.20


## [v0.3.19] - 2026-05-24

### Bug Fixes

- make reward settings entry visible


### Maintenance

- bump version to 0.3.19


## [v0.3.18] - 2026-05-24

### Documentation

- document reward settings


### Features

- show decimal shop pricing

- add parent reward settings UI

- apply streak discounts to shop redemptions

- apply reward settings to tasks

- expose reward settings API

- add reward settings service

- store shop stars as decimals

- add child reward settings model


### Maintenance

- bump version to 0.3.18


### Other

- cover reward settings discounts


## [v0.3.17] - 2026-05-24

### Documentation

- document realtime event streams


### Features

- refresh child pages from realtime events

- add child realtime refresh hooks

- refresh parent pages from realtime events

- add parent realtime refresh hooks

- publish realtime backend events

- add authenticated event streams

- add realtime event hub


### Maintenance

- bump version to 0.3.17


## [v0.3.16] - 2026-05-24

### Bug Fixes

- show sunday in routine weekdays


### Maintenance

- bump version to 0.3.16


## [v0.3.15] - 2026-05-23

### Features

- fold fulfilled redemption history


### Maintenance

- bump version to 0.3.15


## [v0.3.14] - 2026-05-23

### Bug Fixes

- show parent web operation errors

- handle child shop token expiry

- harden redemptions and streak thresholds

- use slow hash for child access codes


### Maintenance

- bump version to 0.3.14

- track backend uv lockfile


### Other

- cover audit regression fixes


## [v0.3.13] - 2026-05-22

### Bug Fixes

- translate shop error messages to Chinese for child PWA


### Maintenance

- bump version to 0.3.13


## [v0.3.12] - 2026-05-22

### Bug Fixes

- child shop errors show reason, banner instead of full-page, wish catches


### Maintenance

- bump version to 0.3.12


## [v0.3.11] - 2026-05-22

### Bug Fixes

- keep tabs mounted to avoid state loss on switch


### Maintenance

- bump version to 0.3.11


## [v0.3.10] - 2026-05-22

### Features

- grade cascade select, input labels, threshold display on child card


### Maintenance

- bump version to 0.3.10


## [v0.3.9] - 2026-05-22

### Bug Fixes

- shallow copy per redemption to isolate identity map


### Maintenance

- bump version to 0.3.9


## [v0.3.8] - 2026-05-22

### Features

- structural redesign — tab navigation, shop page, login polish


### Maintenance

- bump version to 0.3.8


## [v0.3.7] - 2026-05-22

### Maintenance

- bump version to 0.3.7


### Other

- green accent color scheme


## [v0.3.6] - 2026-05-21

### Bug Fixes

- migration server_default for streak_threshold


### Maintenance

- bump version to 0.3.6


## [v0.3.5] - 2026-05-21

### Features

- streak threshold — parent sets completion rate requirement


### Maintenance

- bump version to 0.3.5


## [v0.3.4] - 2026-05-21

### Bug Fixes

- expunge_all before redeemed query to isolate identity map


### Maintenance

- bump version to 0.3.4


## [v0.3.3] - 2026-05-20

### Bug Fixes

- per-redemption shop items with independent status


### Maintenance

- bump version to 0.3.3


## [v0.3.2] - 2026-05-20

### Bug Fixes

- expunge redeemed items to prevent identity map pollution


### Maintenance

- bump version to 0.3.2


## [v0.3.1] - 2026-05-20

### Bug Fixes

- migration server_default for existing redemptions


### Maintenance

- bump version to 0.3.1


## [v0.3.0] - 2026-05-20

### Bug Fixes

- stock visibility + redemption status sync


### Maintenance

- bump version to 0.3.0


## [v0.2.8] - 2026-05-20

### Bug Fixes

- dedup active/redeemed items in child shop list


### Maintenance

- bump version to 0.2.8


## [v0.2.7] - 2026-05-20

### Bug Fixes

- unique constraint on redeem ledger, simplify query


### Maintenance

- bump version to 0.2.7


## [v0.2.6] - 2026-05-20

### Features

- redemption table for per-child redeem tracking


### Maintenance

- bump version to 0.2.6


## [v0.2.5] - 2026-05-20

### Bug Fixes

- filter shop items by status, add stock field, remove description


### Maintenance

- bump version to 0.2.5


## [v0.2.4] - 2026-05-20

### Features

- shop stock, redemptions history, fulfill flow


### Maintenance

- bump version to 0.2.4


## [v0.2.3] - 2026-05-20

### Bug Fixes

- redeem also supports parent-created items


### Maintenance

- bump version to 0.2.3


## [v0.2.2] - 2026-05-20

### Bug Fixes

- parent-created shop items now visible to child


### Maintenance

- bump version to 0.2.2


## [v0.2.1] - 2026-05-20

### Bug Fixes

- child shop route conflict + move shop to stars card


### Maintenance

- bump version to 0.2.1


## [v0.2.0] - 2026-05-20

### Bug Fixes

- template update/delete preserves today's tasks


### Documentation

- update all documentation to reflect current architecture


### Features

- star shop frontend — parent management and child store

- child edit wish + parent edit shop item

- star shop — redeem stars for items, child wishes

- reliable test suite with PostgreSQL and unique test data


### Maintenance

- bump version to 0.2.0


## [v0.1.11] - 2026-05-20

### Maintenance

- bump version to 0.1.11


### Other

- security headers + device token 30-day expiration


## [v0.1.10] - 2026-05-20

### Bug Fixes

- use alembic instead of uv in Docker CMD


### Maintenance

- bump version to 0.1.10


## [v0.1.9] - 2026-05-20

### Bug Fixes

- auto-run alembic migrations on startup


### Maintenance

- bump version to 0.1.9


## [v0.1.8] - 2026-05-20

### Bug Fixes

- host-based routing instead of sub-paths

- Caddy redirect root to /child/ and /parent/ per subdomain


### Documentation

- update quick start and JWT_SECRET docs


### Maintenance

- bump version to 0.1.8


## [v0.1.7] - 2026-05-20

### Bug Fixes

- serve frontend via FastAPI StaticFiles, remove volume mount


### Maintenance

- bump version to 0.1.7


## [v0.1.6] - 2026-05-20

### Maintenance

- bump version to 0.1.6


### Other

- Fix CI build: remove invalid test-dependencies, bind rate limit, bcrypt pin


## [v0.1.5] - 2026-05-19

### Maintenance

- bump version to 0.1.5


### Other

- Remove audit report from public repo

- P0 fixes: JWT_SECRET validation, rate limiting, reward idempotency, unapproved task guard


## [v0.1.4] - 2026-05-19

### Bug Fixes

- retry api health check in CI


### Maintenance

- bump version to 0.1.4


## [v0.1.3] - 2026-05-19

### Bug Fixes

- restore package-lock.json, anonymize paths


### Maintenance

- bump version to 0.1.3


## [v0.1.2] - 2026-05-19

### Maintenance

- bump version to 0.1.2


### Other

- Multi-stage Docker build with frontend, input validation


## [v0.1.1] - 2026-05-19

### Maintenance

- bump version to 0.1.1


## [v0.1.0] - 2026-05-19

### Features

- username/password registration and login


### Maintenance

- use placeholder domains in Caddyfile template

- regenerate CHANGELOG with git-cliff


### Other

- Build Docker image with GHCR, use image in compose

- Add dev compose, Caddyfile, fix CI branch

- Bind API to 127.0.0.1 only, not public

- Fix docker-compose download URL: main -> master

- Add LICENSE, rewrite README, fix JWT_SECRET default

- Remove lock files and cache from repo

- Initial commit: Family Plan v0.1.0


