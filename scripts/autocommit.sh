#!/usr/bin/env bash
# =====================================================================
#  Auto-commit (autosave) daemon — branch-independent snapshot mode
#
#  作業内容の消失を防ぐため、一定間隔で変更を検出して
#  「専用ブランチ」に自動コミット → 自動push します。
#
#  ・HEAD / チェックアウト中のブランチ / 通常のindex には一切触れない
#    （別の index ファイル + git commit-tree でスナップショットを作る）
#    → 他の作業者がブランチを切り替えても、rebase中でも安全に動作
#  ・内容が変わっていなければコミットしない（tree ハッシュ比較）
#  ・push 失敗時は次サイクルで自動リトライ
#
#  使い方:
#    scripts/autocommit.sh start [間隔秒=20]   バックグラウンド起動
#    scripts/autocommit.sh stop                停止
#    scripts/autocommit.sh status              状態と直近ログ
#    scripts/autocommit.sh once                今すぐ1回スナップショット
#    scripts/autocommit.sh restore [dir]       最新スナップショットを dir に展開
#
#  環境変数:
#    AUTOCOMMIT_BRANCH  保存先ブランチ（既定: autosave/gpt5-thinking）
#    AUTOCOMMIT_PATHS   対象パス（空白区切り。既定: gpt5-thinking scripts .gitignore）
#    AUTOCOMMIT_PUSH    1=push する（既定）/ 0=ローカルのみ
# =====================================================================
set -u
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$REPO_DIR/.autocommit"
PID_FILE="$STATE_DIR/daemon.pid"
LOCK_FILE="$STATE_DIR/commit.lock"
LOG_FILE="$STATE_DIR/autocommit.log"
INDEX_FILE="$STATE_DIR/index"
BRANCH="${AUTOCOMMIT_BRANCH:-autosave/gpt5-thinking}"
PATHS="${AUTOCOMMIT_PATHS:-gpt5-thinking scripts .gitignore}"
PUSH="${AUTOCOMMIT_PUSH:-1}"
REF="refs/heads/$BRANCH"
mkdir -p "$STATE_DIR"

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG_FILE"; }

snapshot() {
  cd "$REPO_DIR" || return 1
  (
    flock -n 9 || exit 0
    export GIT_INDEX_FILE="$INDEX_FILE"
    local parent; parent=$(git rev-parse -q --verify "$REF" 2>/dev/null || true)
    # 前回スナップショットを基準に index を構築（なければ空から）
    if [ -n "$parent" ]; then git read-tree "$parent"; else git read-tree --empty; fi
    local existing=()
    for p in $PATHS; do [ -e "$p" ] && existing+=("$p"); done
    [ ${#existing[@]} -eq 0 ] && exit 0
    # 削除も反映させるため対象パスを一度外してから追加
    git rm -r -q --cached --ignore-unmatch -- $PATHS >/dev/null 2>&1
    git add -A -f -- "${existing[@]}" 2>>"$LOG_FILE" || { log "add failed"; exit 1; }
    git ls-files -z -- "${existing[@]}" | grep -zE '(^|/)\.autocommit/' | xargs -0 -r git rm -q --cached >/dev/null 2>&1
    local tree; tree=$(git write-tree)
    if [ -n "$parent" ] && [ "$tree" = "$(git rev-parse "$parent^{tree}")" ]; then exit 0; fi
    local n; n=$( [ -n "$parent" ] && git diff-tree -r --name-only "$parent" "$tree" | wc -l || git ls-tree -r --name-only "$tree" | wc -l )
    local files; files=$( ( [ -n "$parent" ] && git diff-tree -r --name-only "$parent" "$tree" || git ls-tree -r --name-only "$tree" ) | head -6 | tr '\n' ' ')
    local msg="chore(autosave): ${n} file(s) @ $(date '+%Y-%m-%d %H:%M:%S')

Auto-committed by scripts/autocommit.sh
Files: ${files}"
    local commit
    if [ -n "$parent" ]; then commit=$(printf '%s' "$msg" | git commit-tree "$tree" -p "$parent")
    else commit=$(printf '%s' "$msg" | git commit-tree "$tree"); fi
    git update-ref "$REF" "$commit" ${parent:+"$parent"} && log "snapshot ${commit:0:7} (${n} file(s)): ${files}"
    touch "$STATE_DIR/push_pending"
  ) 9>"$LOCK_FILE"
}

push_pending() {
  [ "$PUSH" = "1" ] && [ -f "$STATE_DIR/push_pending" ] || return 0
  cd "$REPO_DIR" || return 1
  git remote get-url origin >/dev/null 2>&1 || return 0
  if timeout 60 git push -q origin "$REF:$REF" >>"$LOG_FILE" 2>&1; then
    rm -f "$STATE_DIR/push_pending"; log "pushed -> origin/$BRANCH"
  else
    log "push failed (retry next cycle)"
  fi
}

run_loop() {
  local interval="${1:-20}"
  log "daemon started (pid $$, every ${interval}s, branch=$BRANCH, paths=[$PATHS], push=$PUSH)"
  trap 'log "daemon stopped"; rm -f "$PID_FILE"; exit 0' INT TERM
  while true; do snapshot; push_pending; sleep "$interval"; done
}

is_running() { [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; }

case "${1:-status}" in
  start)
    if is_running; then echo "already running (pid $(cat "$PID_FILE"))"; exit 0; fi
    nohup setsid "$0" run "${2:-20}" >/dev/null 2>&1 < /dev/null &
    sleep 0.5; echo "auto-commit daemon started (pid $(cat "$PID_FILE" 2>/dev/null)) → $BRANCH" ;;
  stop)
    if is_running; then kill "$(cat "$PID_FILE")"; rm -f "$PID_FILE"; echo "stopped"; else echo "not running"; fi ;;
  status)
    if is_running; then echo "running (pid $(cat "$PID_FILE")) → $BRANCH"; else echo "not running"; fi
    [ -f "$LOG_FILE" ] && tail -5 "$LOG_FILE"; true ;;
  once) snapshot; push_pending; echo "done"; tail -2 "$LOG_FILE" ;;
  restore)
    dest="${2:-$REPO_DIR/.autocommit/restore}"; mkdir -p "$dest"
    git -C "$REPO_DIR" archive "$REF" | tar -x -C "$dest" && echo "restored $BRANCH → $dest" ;;
  run) echo $$ > "$PID_FILE"; run_loop "${2:-20}" ;;
  *) echo "usage: $0 {start [sec]|stop|status|once|restore [dir]}"; exit 1 ;;
esac
