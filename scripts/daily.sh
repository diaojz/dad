#!/bin/bash
set -euo pipefail
shopt -s nullglob

REPO=/Users/diaoye/Documents/dad
STATE="$HOME/.claude/scripts/dad-daily"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
latest_node=''
for candidate in "$HOME"/.nvm/versions/node/v*/bin; do
  if [[ -x "$candidate/node" ]] && {
    [[ -z "$latest_node" ]] ||
      [[ "$(printf '%s\n' "$latest_node" "$candidate" | sort -V | tail -n 1)" == "$candidate" ]]
  }; then
    latest_node="$candidate"
  fi
done
if [[ -n "$latest_node" ]]; then export PATH="$latest_node:$PATH"; fi

today="$(date +%F)"
mkdir -p "$STATE/logs"
exec >>"$STATE/logs/$today.log" 2>&1
printf '\n[%s] 开始每日来信\n' "$(date '+%F %T')"

notify() {
  osascript - "$1" <<'APPLESCRIPT' || echo 'macOS 通知发送失败'
on run argv
  display notification (item 1 of argv) with title "爸爸的信"
end run
APPLESCRIPT
}

fail() {
  printf '%s\n' "$1"
  notify "$1"
  exit 1
}

cd "$REPO"
git pull --rebase || echo 'git pull --rebase 失败，继续处理本地内容'
npm ci || fail '依赖安装失败，今天的信未同步'

if replies="$(gh issue list -R diaojz/dad --label reply --state open --limit 1000 --json number,title,body,createdAt,author)"; then
  printf '%s' "$replies" | node --input-type=module -e "$(cat <<'NODE'
import { mkdir, writeFile, readFile } from 'node:fs/promises';

await mkdir('son/replies', { recursive: true });
for (const issue of JSON.parse(await readFile('/dev/stdin', 'utf8'))) {
  const file = `son/replies/issue-${issue.number}.md`;
  const content = `# ${issue.title}\n\n作者：${issue.author?.login ?? '未知'}\n时间：${issue.createdAt}\n\n${issue.body ?? ''}\n`;
  try {
    await writeFile(file, content, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}
NODE
)" || echo '回信写入失败，继续'
else
  echo 'GitHub 回信查询失败，继续'
fi

letters=(letters/"$today"*.md)
if (( ${#letters[@]} == 0 )); then
  day_prompt="$(cat prompts/daily.md)" || fail '每日提示词读取失败'
  claude -p "$day_prompt" --model opus --dangerously-skip-permissions || echo 'Claude 执行失败，检查是否已生成信件'
  letters=(letters/"$today"*.md)
fi
(( ${#letters[@]} == 1 )) || fail "需要恰好一封 $today 的信，实际找到 ${#letters[@]} 封"
subject="$(node --input-type=module - "${letters[0]}" "$today" <<'NODE'
import { readLetter } from './site/letters.mjs';
const letter = await readLetter(process.argv[2]);
if (letter.date !== process.argv[3] || /[\r\n]/.test(letter.title)) {
  throw new Error('信件日期须为今天，标题须为单行');
}
console.log(`第${letter.no}封：${letter.title}`);
NODE
)" || fail '今天的信格式校验失败'

node site/xhs.mjs "$today" || echo '小红书卡片渲染失败，继续构建站点'
npm run build || fail '站点构建失败，今天的信未同步'

paths=(letters curriculum son)
if [[ -d xhs ]] || [[ -n "$(git ls-files -- xhs)" ]]; then paths+=(xhs); fi
git add -A -- "${paths[@]}" || fail '信件暂存失败'
if ! git diff --cached --quiet -- "${paths[@]}"; then
  git commit --only -m "$subject" -- "${paths[@]}" || fail '信件提交失败'
fi
git push || fail '信件推送失败，下次运行会重试'
notify "今天的信到了：${subject#*：}"
