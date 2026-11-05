#!/usr/bin/env bash
set -euo pipefail
script=$(cd "$(dirname "$0")" && pwd)/sync-meiohi.sh
fixture=$(mktemp -d)
trap 'rm -rf "$fixture"' EXIT
export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null
export GIT_AUTHOR_NAME='Sync Test' GIT_AUTHOR_EMAIL='sync@example.invalid'
export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME" GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"
git init -q --bare "$fixture/main.git"
git init -q --bare "$fixture/source.git"
git init -q -b master "$fixture/seed"
cd "$fixture/seed"
printf 'base\n' > base.txt
git add base.txt
git commit -qm base
git remote add origin "$fixture/main.git"
git remote add source "$fixture/source.git"
git push -q origin master
git push -q source master
printf 'source\n' > source.txt
git add source.txt
git commit -qm source
source_sha=$(git rev-parse HEAD)
git push -q source master
git clone -q "$fixture/main.git" "$fixture/work"
cd "$fixture/work"
git remote set-url origin https://github.com/j2st1n/family-plan.git
git remote add meiohi https://github.com/meiohi/family-plan.git
git config url."$fixture/main.git".insteadOf https://github.com/j2st1n/family-plan.git
git config url."$fixture/source.git".insteadOf https://github.com/meiohi/family-plan.git
bash "$script" --prepare > "$fixture/prepare.log" 2>&1
git merge-base --is-ancestor "$source_sha" HEAD
test "$(git rev-parse origin/master)" != "$(git rev-parse HEAD)"
test "$(git --git-dir="$fixture/main.git" rev-parse master)" = "$(git rev-parse origin/master)"
git push -q origin HEAD:master
bash "$script" --prepare > "$fixture/noop.log" 2>&1
grep -q 'Already synchronized' "$fixture/noop.log"
printf 'dirty\n' >> source.txt
if bash "$script" --prepare > "$fixture/dirty.log" 2>&1; then echo 'Dirty tree was accepted' >&2; exit 1; fi
grep -q 'not clean' "$fixture/dirty.log"
git restore source.txt
# Divergent edits must stop locally and never push an unresolved merge.
printf 'main edit\n' > base.txt
git add base.txt
git commit -qm main-edit
git push -q origin HEAD:master
cd "$fixture/seed"
printf 'source edit\n' > base.txt
git add base.txt
git commit -qm source-edit
git push -q source master
cd "$fixture/work"
if bash "$script" --branch > "$fixture/conflict.log" 2>&1; then echo 'Conflicting merge was accepted' >&2; exit 1; fi
test -n "$(git ls-files -u)"
test "$(git --git-dir="$fixture/main.git" for-each-ref --format='%(refname)' refs/heads | wc -l | tr -d ' ')" = 1
git merge --abort
# Resolve on source then verify branch-only mode publishes a separate review branch.
cd "$fixture/seed"
git fetch -q origin master
git merge --no-commit --no-ff FETCH_HEAD > /dev/null 2>&1 || true
printf 'resolved\n' > base.txt
git add base.txt
git commit -qm resolved
git push -q source master
cd "$fixture/work"
GITHUB_OUTPUT="$fixture/outputs" bash "$script" --branch > "$fixture/branch.log" 2>&1
grep -q '^branch=sync/meiohi-' "$fixture/outputs"
grep -q '^compare_url=https://github.com/j2st1n/family-plan/compare/master' "$fixture/outputs"
test "$(git --git-dir="$fixture/main.git" rev-parse master)" = "$(git rev-parse origin/master)"
test "$(git --git-dir="$fixture/main.git" rev-parse "$(git branch --show-current)")" = "$(git rev-parse HEAD)"
echo 'Sync tests passed: history, no-op, dirty tree, conflict isolation, review branch.'
