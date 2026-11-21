#!/bin/bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
state="$HOME/.claude/scripts/dad-daily"
agents="$HOME/Library/LaunchAgents"
label=com.diaojz.dad-daily

printf '# 安装命令（按需手动执行）\n'
printf 'mkdir -p %q %q\n' "$state/logs" "$agents"
printf 'install -m 755 %q %q\n' "$here/daily.sh" "$state/run.sh"
printf 'install -m 644 %q %q\n' "$here/$label.plist.template" "$agents/$label.plist"
printf 'launchctl bootstrap gui/$(id -u) %q\n' "$agents/$label.plist"
