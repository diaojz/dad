#!/bin/bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
state="$HOME/.claude/scripts/dad-daily"
agents="$HOME/Library/LaunchAgents"
label=com.diaojz.dad-daily
domain="gui/$(id -u)"
publisher="/Users/diaoye/Documents/diao/media/xhs/xhs-publish-cdp.py"

if [[ ! -f "$publisher" ]]; then
  printf '找不到发布脚本：%s\n' "$publisher" >&2
  exit 1
fi

mkdir -p "$state/logs" "$state/done" "$agents"
install -m 644 "$publisher" "$state/xhs-publish-cdp.py"
install -m 755 "$here/daily.sh" "$state/run.sh"
install -m 644 "$here/$label.plist.template" "$agents/$label.plist"
launchctl bootout "$domain/$label" 2>/dev/null || true
launchctl bootstrap "$domain" "$agents/$label.plist"
printf '已安装每日触发时间（Mac 系统时区）：06:30、08:30、10:30、13:00、17:00、21:00\n'
