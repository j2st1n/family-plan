#!/usr/bin/env bash
set -euo pipefail

mode=${1:---prepare}
if [[ "$mode" != --prepare && "$mode" != --branch && "$mode" != --pr ]]; then
  echo "Usage: $0 [--prepare|--branch|--pr]" >&2
  exit 2
fi
repo=$(git rev-parse --show-toplevel)
cd "$repo"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or preserve your changes before syncing." >&2
  exit 1
fi
case "$(git config --get remote.origin.url)" in
  https://github.com/j2st1n/family-plan|https://github.com/j2st1n/family-plan.git|git@github.com:j2st1n/family-plan.git) ;;
  *) echo "origin must point to j2st1n/family-plan; no remote was changed." >&2; exit 1 ;;
esac
if git config --get remote.meiohi.url >/dev/null 2>&1; then
  case "$(git config --get remote.meiohi.url)" in
    https://github.com/meiohi/family-plan|https://github.com/meiohi/family-plan.git|git@github.com:meiohi/family-plan.git) ;;
    *) echo "meiohi points to an unexpected repository; no remote was changed." >&2; exit 1 ;;
  esac
else
  git remote add meiohi https://github.com/meiohi/family-plan.git
fi
git fetch --no-tags origin refs/heads/master:refs/remotes/origin/master
git fetch --no-tags meiohi refs/heads/master:refs/remotes/meiohi/master
source_sha=$(git rev-parse meiohi/master)
if git merge-base --is-ancestor "$source_sha" origin/master; then
  echo "Already synchronized: meiohi/master $source_sha is included in origin/master."
  exit 0
fi
branch="sync/meiohi-${source_sha:0:12}-$(date -u +%Y%m%dT%H%M%SZ)"
git switch -c "$branch" origin/master
if ! git merge --no-ff --no-edit meiohi/master; then
  echo "Resolve conflicts in $branch, review and test, then commit. Nothing was pushed." >&2
  echo "To abandon this attempt: git merge --abort" >&2
  exit 1
fi
if [[ "$mode" == --prepare ]]; then
  echo "Prepared $branch. Review and test before pushing or opening a pull request."
  exit 0
fi
if [[ "$mode" == --pr ]]; then
  command -v gh >/dev/null || { echo "GitHub CLI (gh) is required for --pr." >&2; exit 1; }
fi
git push --set-upstream origin "$branch"
compare_url="https://github.com/j2st1n/family-plan/compare/master...$branch"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'branch=%s\ncompare_url=%s\n' "$branch" "$compare_url" >> "$GITHUB_OUTPUT"
fi
if [[ "$mode" == --branch ]]; then
  echo "Review the synchronization and create a PR: $compare_url"
  exit 0
fi
body=$(mktemp)
trap 'rm -f "$body"' EXIT
cat > "$body" <<EOF
## 更新来源

从 meiohi/family-plan 的 master 合入 $source_sha，保留原提交历史。

## 验证

这是同步草稿，需审查差异并运行 CI；存在冲突时同步脚本不会推送。
请使用 **Create a merge commit** 合入，以保留后续增量同步的共同历史。

本次同步不会发布版本标签、部署生产或导入数据库。
EOF
gh pr create --repo j2st1n/family-plan --base master --head "$branch" --draft \
  --title "Sync meiohi development (${source_sha:0:12})" --body-file "$body"
