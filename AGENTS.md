# 爸爸的信 · 项目规则

一个 AI 扮演的父亲，每天给一个写了十几年代码的儿子写一封信，只讲一个认知：校准过时的经验、补全没人讲的规律、确认该守住的老道理。网站 https://diaojz.github.io/dad/ ，信件同步改编到小红书。

## 目录

| 路径 | 作用 |
|---|---|
| `prompts/persona.md` | 爸爸的人设：生平时间线、口吻、禁忌（虚构人物，往事可编、研究必须真） |
| `prompts/father.md` | 写信原则与写作宪法（灵魂文件，慎改） |
| `prompts/cover.md` | 油画封面的画风与构图（前 5 封及无水彩图时的兜底）；信件 frontmatter `cover` 写场景 |
| `prompts/cover-xhs.md` | 明亮淡彩水彩封面的画风与构图（第 6 封起，网页和小红书共用） |
| `prompts/daily.md` | 每日写信任务指令（`claude -p` 无人值守执行） |
| `prompts/xhs.md` | 小红书改编规则 |
| `son/profile.md` | 儿子画像（公开，不写公司/项目/家人姓名） |
| `son/replies/` | 儿子的回信（GitHub Issue `reply` 标签自动同步） |
| `curriculum/map.md` / `ledger.md` | 选题罗盘 / 已讲清单（防重复） |
| `curriculum/memories.md` | 爸爸讲过的往事（细节不得前后矛盾，每封追加） |
| `letters/` | 每日信件 `YYYY-MM-DD-slug.md` |
| `xhs/<date>/` | 小红书改编稿 post.json + 渲染卡片（png 不入库） |
| `site/` | 静态站构建 + 小红书卡片渲染器；`site/static/covers/` 封面图，`site/static/father.jpg` 爸爸页画像 |
| `scripts/kindle.py` | 把 RSS 全部信合成一本《爸爸的信》AZW3 到 `~/.claude/scripts/dad-daily/kindle/`（daily.sh 每天重建）；USB 连上 Kindle 后跑 `python3 -I scripts/kindle.py --copy` 拷入（邮件推送收不到，已弃用） |
| `share/moments/` | 朋友圈推广素材（配图 + 文案） |
| `scripts/daily.sh` | 每日流水线；安装副本在 `~/.claude/scripts/dad-daily/run.sh`（launchd 每日多次触发，按 `done` 标记补做并重试网络操作，末尾用 `scripts/xhs_draft.py` 自动存小红书草稿，发布仍由用户手点）。launchd 读不了 ~/Documents，所以它在 `~/.claude/scripts/dad-daily/repo` 用独立克隆干活并直接推 GitHub——**在 ~/Documents/diao/dad 动手前先 `git pull`** |

## 规则

- 「写今天的信」= 按 `prompts/daily.md` 执行。信由 Claude（Opus）亲自写，不委派；站点/脚本类大改动委派 Codex。
- 写信前读 persona.md 与 memories.md，新往事要对得上生平并追加登记；正文不用 `##` 小标题。
- 事实性论断必须查证并在「出处」标证据强度；查不到就降级为「我的判断」或删掉。
- 小红书发在「城北 | AI Coding」的「爸爸的信」合集（原创 + AI 合成声明，meta.json 默认已带）；只存草稿（`red-publish`），发布由用户手点。存草稿前若已声明原创，别再点原创开关（会关掉）。话题写进 post.json 的 `topics`，由发布脚本点选成真话题（规则见 `prompts/xhs.md`）。
- 可以提前写信（日期填未来）：站点和 RSS 只发布北京时间今天及以前的信，Pages 每天 00:05 定时重建，到日子流水线会补封面、卡片、Kindle 和小红书草稿。
- 封面画只用 Codex 原生 image_gen（daily.sh 的 `make_cover`），失败时网站有兜底。
- 第 6 封起封面走明亮淡彩水彩（2026-11-26 用户定：油画版太阴暗）：规则 `prompts/cover-xhs.md`，图存 `site/static/covers/<slug>-xhs.jpg`（`make_cover_xhs`），卡片样式 `site/xhs.css`；网页和小红书都优先用它，没有才回退 `<slug>.jpg` 油画（`daily.sh` 现在只在水彩生成失败时才画油画兜底）。前 5 封保留油画不重画，「爸爸是谁」页有说明。
- `git add` 只加本次改动的路径，别用 `-A`（目录里可能有其他会话未完成的文件）。
- 改 `scripts/daily.sh` 或 `~/Documents/diao/media/xhs/xhs-publish-cdp.py` 后重新跑 `scripts/install-launchd.sh` 同步副本。
- 内容 CC BY-NC-SA 4.0，代码 MIT。

- 移动端适配回归：改站点后跑 `python3 scripts/mobile-matrix.py <站点根URL含base> <截图目录> <文章路径> [关于页路径]`（需先把 dist 软链到与 base 同名子目录并用 `python3 -m http.server` 提供）。覆盖 12 种手机/iPad 尺寸 × 微信/飞书 UA × 关 JS，查横向溢出、字号、点击区域、图片、控制台；Chromium 模拟不能代替真机，上线后需在真微信/飞书里再看一眼。
