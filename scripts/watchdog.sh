#!/usr/bin/env bash
# デーモンが落ちていたら再起動する（シェル起動時やcronから呼び出す）
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$DIR/autocommit.sh" status | grep -q '^running' || "$DIR/autocommit.sh" start "${1:-20}"
