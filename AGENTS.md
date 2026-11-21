# 爸爸的信 · 项目规则

一个 AI 扮演的父亲，每天给一个写了十几年代码的儿子写一封信，只讲一个认知：校准过时的经验、补全没人讲的规律、确认该守住的老道理。网站 https://diaojz.github.io/dad/ ，信件同步改编到小红书。

## 目录

| 路径 | 作用 |
|---|---|
| `prompts/father.md` | 父亲的人格与写作宪法（灵魂文件，慎改） |
| `prompts/daily.md` | 每日写信任务指令（`claude -p` 无人值守执行） |
| `prompts/xhs.md` | 小红书改编规则 |
| `son/profile.md` | 儿子画像（公开，不写公司/项目/家人姓名） |
| `son/replies/` | 儿子的回信（GitHub Issue `reply` 标签自动同步） |
| `curriculum/map.md` / `ledger.md` | 选题罗盘 / 已讲清单（防重复） |
| `letters/` | 每日信件 `YYYY-MM-DD-slug.md` |
| `xhs/<date>/` | 小红书改编稿 post.json + 渲染卡片（png 不入库） |
| `site/` | 静态站构建 + 小红书卡片渲染器 |
| `scripts/daily.sh` | 每日流水线；安装副本在 `~/.claude/scripts/dad-daily/run.sh`（launchd 06:30，TCC 限制不能直接跑 Documents 下脚本） |

## 规则

- 「写今天的信」= 按 `prompts/daily.md` 执行。信由 Claude（Opus）亲自写，不委派；站点/脚本类大改动委派 Codex。
- 事实性论断必须查证并在「出处」标证据强度；查不到就降级为「我的判断」或删掉。
- 小红书发在「城北 | AI Coding」的「爸爸的信」合集（原创 + AI 合成声明，meta.json 默认已带）；只存草稿（diao-xhs-publish），发布由用户手点。存草稿前若已声明原创，别再点原创开关（会关掉）。
- 改 `scripts/daily.sh` 后重新跑 `scripts/install-launchd.sh` 同步副本。
- 内容 CC BY-NC-SA 4.0，代码 MIT。
