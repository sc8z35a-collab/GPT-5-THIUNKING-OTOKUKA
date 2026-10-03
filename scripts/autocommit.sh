#!/usr/bin/env bash
# =====================================================================
#  Auto-commit daemon
#  作業内容の消失を防ぐため、一定間隔で変更を検出 → 自動コミット → 自動push
#
#  使い方:
#    scripts/autocommit.sh start   [間隔秒=20]   バックグラウンドで起動
#    scripts/autocommit.sh stop                  停止
#    scripts/autocommit.sh status                状態確認
#    scripts/autocommit.sh once                  1回だけ実行
#    scripts/autocommit.sh run     [間隔秒=20]   フォアグラウンド実行
#
#  環境変数:
#    AUTOCOMMIT_PUSH=0      pushを無効化（既定: 1 = pushする）
#    AUTOCOMMIT_QUIET=10    最終変更から何秒経過したらコミットするか（書き込み途中を避ける）
# =====================================================================
set -u
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$REPO_DIR/.autocommit"
PID_FILE="$STATE_DIR/daemon.pid"
LOCK_FILE="$STATE_DIR/commit.lock"
LOG_FILE="$STATE_DIR/autocommit.log"
PUSH="${AUTOCOMMIT_PUSH:-1}"
QUIET="${AUTOCOMMIT_QUIET:-10}"
mkdir -p "$STATE_DIR"

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG_FILE"; }

# 作業ツリー内で最後に変更されたファイルからの経過秒数
seconds_since_last_change() {
  local newest
  newest=$(cd "$REPO_DIR" && git ls-files -m -o --exclude-standard -z 2>/dev/null \
            | xargs -0 -r stat -c '%Y' 2>/dev/null | sort -n | tail -1)
  [ -z "$newest" ] && { echo 999999; return; }
  echo $(( $(date +%s) - newest ))
}

commit_once() {
  cd "$REPO_DIR" || return 1
  # rebase/merge中は触らない
  if [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ] || [ -f .git/MERGE_HEAD ]; then
    log "skip: rebase/merge in progress"; return 0
  fi
  (
    flock -n 9 || { log "skip: another commit running"; exit 0; }
    if [ -z "$(git status --porcelain)" ]; then exit 0; fi
    local idle; idle=$(seconds_since_last_change)
    if [ "$idle" -lt "$QUIET" ]; then log "wait: files still changing (${idle}s)"; exit 0; fi

    git add -A
    local files; files=$(git diff --cached --name-only | head -5 | tr '\n' ' ')
    local count; count=$(git diff --cached --name-only | wc -l)
    git commit -q -m "chore(autosave): ${count} file(s) @ $(date '+%Y-%m-%d %H:%M:%S')" \
               -m "Auto-committed by scripts/autocommit.sh" -m "Files: ${files}" \
      && log "committed ${count} file(s): ${files}"

    if [ "$PUSH" = "1" ] && git remote get-url origin >/dev/null 2>&1; then
      local branch; branch=$(git rev-parse --abbrev-ref HEAD)
      if timeout 60 git push -q origin "$branch" >>"$LOG_FILE" 2>&1; then
        log "pushed -> origin/$branch"
      else
        log "push failed (will retry next cycle)"
        touch "$STATE_DIR/push_pending"
      fi
    fi
  ) 9>"$LOCK_FILE"
}

retry_pending_push() {
  [ -f "$STATE_DIR/push_pending" ] || return 0
  cd "$REPO_DIR" || return 1
  local branch; branch=$(git rev-parse --abbrev-ref HEAD)
  if timeout 60 git push -q origin "$branch" >>"$LOG_FILE" 2>&1; then
    rm -f "$STATE_DIR/push_pending"; log "pending push succeeded -> origin/$branch"
  fi
}

run_loop() {
  local interval="${1:-20}"
  log "daemon started (pid $$, interval ${interval}s, push=${PUSH})"
  trap 'log "daemon stopped"; rm -f "$PID_FILE"; exit 0' INT TERM
  while true; do
    commit_once
    [ "$PUSH" = "1" ] && retry_pending_push
    sleep "$interval"
  done
}

is_running() { [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; }

case "${1:-status}" in
  start)
    if is_running; then echo "already running (pid $(cat "$PID_FILE"))"; exit 0; fi
    nohup "$0" run "${2:-20}" >/dev/null 2>&1 &
    echo $! > "$PID_FILE"; sleep 0.3
    echo "auto-commit daemon started (pid $(cat "$PID_FILE")), log: $LOG_FILE" ;;
  stop)
    if is_running; then kill "$(cat "$PID_FILE")"; rm -f "$PID_FILE"; echo "stopped"; else echo "not running"; fi ;;
  status)
    if is_running; then echo "running (pid $(cat "$PID_FILE"))"; else echo "not running"; fi
    [ -f "$LOG_FILE" ] && tail -5 "$LOG_FILE" ;;
  once) QUIET=0 commit_once; echo "done" ;;
  run)  echo $$ > "$PID_FILE"; run_loop "${2:-20}" ;;
  *) echo "usage: $0 {start [sec]|stop|status|once|run [sec]}"; exit 1 ;;
esac
