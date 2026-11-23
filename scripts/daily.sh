#!/bin/bash
set -euo pipefail
shopt -s nullglob
export TZ=Asia/Shanghai

STATE="$HOME/.claude/scripts/dad-daily"
# launchd 进程读不了 ~/Documents（macOS TCC，报 Operation not permitted），
# 所以定时任务在 dotfolder 里维护一份独立克隆，干完直接推 GitHub；~/Documents/dad 用时先 git pull。
REPO="$STATE/repo"
REMOTE=https://github.com/diaojz/dad.git
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
# launchd 不加载 shell 配置，没有代理变量；本机 Clash 在 7890 时补上，否则 GitHub/Claude 连不上。
configure_proxy() {
  if nc -z 127.0.0.1 7890 2>/dev/null; then
    export HTTP_PROXY=http://127.0.0.1:7890 HTTPS_PROXY=http://127.0.0.1:7890 ALL_PROXY=http://127.0.0.1:7890
    export http_proxy=$HTTP_PROXY https_proxy=$HTTPS_PROXY all_proxy=$ALL_PROXY
  fi
}

today="$(date +%F)"
done_dir="$STATE/done"
mkdir -p "$STATE/logs" "$done_dir"
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

lock="$STATE/lock"
if ! mkdir "$lock" 2>/dev/null; then
  if [[ ! -d "$lock" ]]; then
    fail '无法创建流水线锁'
  fi
  modified="$(stat -f %m "$lock" 2>/dev/null)" || exit 0
  if (( $(date +%s) - modified <= 10800 )) ||
    ! rmdir "$lock" 2>/dev/null || ! mkdir "$lock" 2>/dev/null; then
    echo '已有流水线在运行'
    exit 0
  fi
fi
lock_identity="$(stat -f '%i:%B' "$lock")"
release_lock() {
  if [[ "$(stat -f '%i:%B' "$lock" 2>/dev/null)" == "$lock_identity" ]]; then
    rmdir "$lock"
  fi
}
trap release_lock EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

pushed="$done_dir/$today.pushed"
kindle="$done_dir/$today.kindle"
xhs="$done_dir/$today.xhs"
if [[ -f "$pushed" && -f "$kindle" && -f "$xhs" ]]; then
  echo '今日步骤已完成'
  exit 0
fi

retry() {
  local delay
  "$@" && return 0
  for delay in 30 60 120; do
    printf '命令失败，%s 秒后重试：%s %s\n' "$delay" "$1" "$2" >&2
    sleep "$delay"
    "$@" && return 0
  done
  return 1
}

wait_for_network() {
  local deadline=$((SECONDS + 600)) remaining
  while (( (remaining = deadline - SECONDS) > 0 )); do
    configure_proxy
    curl -sS -m "$((remaining < 10 ? remaining : 10))" -o /dev/null https://github.com && return 0
    remaining=$((deadline - SECONDS))
    if (( remaining > 0 )); then sleep "$((remaining < 10 ? remaining : 10))"; fi
  done
  return 1
}

push_ahead() {
  local ahead
  ahead="$(git rev-list --count '@{u}..HEAD')" || fail '无法检查待推送提交'
  if (( ahead > 0 )); then
    retry git push || fail '信件推送失败，下次运行会重试'
  fi
}

wait_for_network || fail 'GitHub 网络未就绪，下次运行会重试'
[[ -d "$REPO/.git" ]] || retry git clone "$REMOTE" "$REPO" || fail '克隆仓库失败'
cd "$REPO"
retry git pull --rebase || fail '同步仓库失败，下次运行会重试'
push_ahead

if [[ ! -f "$pushed" || ! -d node_modules ]]; then
  npm ci || fail '依赖安装失败，下次运行会重试'
fi

if [[ ! -f "$pushed" ]] && replies="$(retry gh issue list -R diaojz/dad --label reply --state open --limit 1000 --json number,title,body,createdAt,author)"; then
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
elif [[ ! -f "$pushed" ]]; then
  echo 'GitHub 回信查询失败，继续'
fi

letters=(letters/"$today"*.md)
if [[ ! -f "$pushed" ]] && (( ${#letters[@]} == 0 )); then
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

make_cover() {
  local letter="$1" target="$2" prompt staging generated
  staging="$(mktemp -d "$REPO/.cover-XXXXXX")" || return 1
  generated="$staging/${target##*/}"
  prompt="$(node --input-type=module - "$letter" "$generated" <<'NODE'
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readLetter } from './site/letters.mjs';

const letter = await readLetter(process.argv[2]);
if (!letter.cover) process.exit(0);
const rules = await readFile('prompts/cover.md', 'utf8');
const start = rules.indexOf('## 统一画风');
const end = rules.indexOf('## 每封信的场景', start);
if (start < 0 || end < 0) throw new Error('未找到封面画风与构图');
const target = resolve(process.argv[3]);
console.log(`只用原生 image_gen__imagegen 工具生成一幅封面画。禁止第三方 API、脚本生图或直调 OPENAI_API_KEY。原生工具不可用或调用失败就报错退出。
${rules.slice(start, end).trim()}

本封场景：${letter.cover}

检查画面里没有文字、签名和水印。将原生工具生成的图片转成质量 85、长边不超过 1600 像素的 JPG，保存到 ${target}。只写入这一个项目文件，不提交、不推送。`);
NODE
)" || { rmdir "$staging"; return 1; }
  if [[ -z "$prompt" ]]; then
    rmdir "$staging"
    echo "信件没有 cover 字段，使用封面兜底：$letter"
    return 0
  fi
  if printf '%s\n' "$prompt" | codex exec --skip-git-repo-check -C "$REPO" \
    -c approval_policy=never -c sandbox_mode=workspace-write - &&
    node --input-type=module - "$generated" <<'NODE'
import sharp from 'sharp';

const image = sharp(process.argv[2]);
const { width, height, format } = await image.metadata();
if (format !== 'jpeg' || Math.max(width, height) > 1600) throw new Error('封面格式或尺寸不符');
await image.raw().toBuffer();
NODE
  then
    if mkdir -p "$(dirname "$target")" && mv -n "$generated" "$target"; then
      rm -f "$generated"
      rmdir "$staging"
      printf '已生成封面：%s\n' "$target"
      return 0
    fi
  fi
  rm -f "$generated"
  rmdir "$staging"
  return 1
}

if [[ ! -f "$pushed" ]]; then
  slug="${letters[0]##*/}"
  cover="site/static/covers/${slug%.md}.jpg"
  if [[ ! -s "$cover" ]]; then
    make_cover "${letters[0]}" "$cover" || echo "封面生成失败，继续构建：$cover"
  fi

  node site/xhs.mjs "$today" || echo '小红书卡片渲染失败，继续构建站点'
  npm run build || fail '站点构建失败，今天的信未同步'

  paths=(letters curriculum son)
  if [[ -d xhs ]] || [[ -n "$(git ls-files -- xhs)" ]]; then paths+=(xhs); fi
  if [[ -d site/static/covers ]] || [[ -n "$(git ls-files -- site/static/covers)" ]]; then paths+=(site/static/covers); fi
  git add -A -- "${paths[@]}" || fail '信件暂存失败'
  if ! git diff --cached --quiet -- "${paths[@]}"; then
    git commit --only -m "$subject" -- "${paths[@]}" || fail '信件提交失败'
  fi
  push_ahead
  touch "$pushed"
  notify "今天的信到了：${subject#*：}"
fi

if [[ ! -f "$kindle" ]]; then
  if { [[ -s dist/feed.xml ]] || npm run build; } && python3 -I scripts/kindle.py; then
    touch "$kindle"
  else
    echo 'Kindle 电子书生成失败，下次运行会重试'
  fi
fi

if [[ ! -f "$xhs" ]]; then
  xhs_dir="xhs/$today"
  cards=("$xhs_dir"/[0-9][0-9].png)
  if [[ ! -s "$xhs_dir/meta.json" ]] || (( ${#cards[@]} == 0 )); then
    node site/xhs.mjs "$today" || echo '小红书卡片渲染失败'
  fi
  if draft_result="$(python3 -I scripts/xhs_draft.py "$xhs_dir" 2>&1)"; then
    printf '%s\n' "$draft_result"
    touch "$xhs"
    notify "${subject%%：*}已存小红书草稿，去手机上点发布"
  else
    printf '%s\n' "$draft_result"
    notify "小红书草稿失败：${draft_result##*$'\n'}"
  fi
fi
