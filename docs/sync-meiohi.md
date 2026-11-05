# 同步 meiohi 开发仓

`j2st1n/family-plan` 是主仓，`meiohi/family-plan` 是继续开发的来源。主仓保留双方历史和适配修复。同步源码、发布镜像、升级生产是独立动作；同步不会改动当前生产实例或数据库。

## 在 GitHub 发起同步

1. 打开主仓的 Actions → **Sync meiohi development**。
2. 点击 **Run workflow**，分支选择 `master`。
3. 有更新且自动合并成功时，工作流推送独立同步分支，并在运行摘要提供比较链接；点击链接审查差异、创建 PR。没有更新则直接结束。
4. 运行并检查 CI，必要时处理接口或界面回归。
5. 使用 **Create a merge commit** 合入。不要 squash 或 rebase 这类同步 PR，否则会丢失来源提交的祖先关系，影响下一次增量同步。

工作流只手动触发，不定时运行，不自动合并或部署。它不执行刚拉取的应用代码；代码测试在 PR 的独立 CI 中执行。

当前仓库禁止 Actions 自行创建 PR。网页流程使用同步分支和比较链接，保留这项设置，仅申请推送同步分支所需的 contents 权限。也可以使用下述已登录 GitHub CLI 的本机流程直接创建草稿 PR。

## 在本机发起同步

在干净的主仓检出里执行：

```bash
bash scripts/sync-meiohi.sh --prepare
```

脚本拉取两个远端，从最新主仓创建独立同步分支，再合并开发仓；已有的主仓修复会参与三方合并。没有更新时不创建分支。它不会覆盖未提交修改，也不会强制推送。

如果希望同时推送并创建草稿 PR，先确认 `gh` 已登录，再运行：

```bash
bash scripts/sync-meiohi.sh --pr
```

有冲突时会停止，不推送。解决冲突后检查 `git status`，审查和测试，再提交并推送该分支。需要放弃时使用 `git merge --abort`。上游存在重写历史或其他异常时，应人工核对，不要用强制推送绕过。

## 合并检查

- 日期切换与迟到响应不能让旧日期的数据覆盖当前选择。
- 历史页面只读取已有任务，不应自动生成过去的待办。
- 任务审核、奖励账本、休假和保护卡语义应与连胜重算兼容。
- 连胜配置读取与保存使用 `streak_discount_enabled` 和 `streak_discount_tiers`，完整保留自定义档位。
- 两端分享需使用对应日期的有效快照，写操作期间禁止导出过期记录。
- 运行双端 npm 测试、构建、日期/刷新/分享模型测试，以及隔离 PostgreSQL 后端回归。

测试通过的同步 PR 合入主仓后，再按需要发布版本标签和镜像。当前运行的固定镜像不会因为仓库更新而自动升级。

参考：[GitHub 工作流触发与 GITHUB_TOKEN 行为](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)。
