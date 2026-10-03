#!/usr/bin/env bash
# =====================================================================
#  Watchdog for the auto-commit daemon (cron が無い環境向け)
#  autocommit デーモンが落ちていたら自動で再起動する常駐スクリプト。
#
#    scripts/watchdog.sh start [間隔秒=20]   watchdog を常駐起動（デーモンも起動）
#    scripts/watchdog.sh stop                watchdog とデーモンを停止
#    scripts/watchdog.sh check               1回だけ確認して必要なら起動
# =====================================================================
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE="$DIR/../.autocommit"; mkdir -p "$STATE"
WPID="$STATE/watchdog.pid"
check() { "$DIR/autocommit.sh" status | grep -q '^running' || { "$DIR/autocommit.sh" start "${1:-20}" >/dev/null; printf '[%s] watchdog: daemon (re)started\n' "$(date '+%F %T')" >> "$STATE/autocommit.log"; }; }
case "${1:-check}" in
  start)
    if [ -f "$WPID" ] && kill -0 "$(cat "$WPID")" 2>/dev/null; then echo "watchdog already running"; check "${2:-20}"; exit 0; fi
    nohup setsid bash -c "echo \$\$ > '$WPID'; while true; do '$0' check '${2:-20}'; sleep 15; done" >/dev/null 2>&1 < /dev/null &
    sleep 1; check "${2:-20}"; echo "watchdog started (pid $(cat "$WPID"))" ;;
  stop) [ -f "$WPID" ] && kill "$(cat "$WPID")" 2>/dev/null; rm -f "$WPID"; "$DIR/autocommit.sh" stop ;;
  check) check "${2:-20}" ;;
esac
