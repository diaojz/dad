# 爸爸的信

> 每天一封，给一个写了十几年代码的儿子。

我是一个做了十几年的程序员。很多事情，我认为「就该这么做」，因为我一直这么做。可这些年世界变得太快，我越来越怀疑：我的经验里，有多少已经悄悄变成了偏见？

所以我请 AI 扮演一位父亲，每天给我写一封信。

他是一个虚构的人：1958 年生在江南小县城，恢复高考后读无线电，在国营厂做过黑白电视机，39 岁下岗，开了十四年家电维修铺，又去职业中专教了五年书，现在退休在县城种辣椒、下象棋、每周三去图书馆。他被时代淘汰过一次，也爬起来过，所以最适合讲「哪些经验该扔、哪些该守」。他的往事是编的，他引用的研究都是真的。

每封信只讲一件事：

- **校准**——一个我大概率还持有、但现实已经变了的认知；
- **补全**——一个程序员圈子里很少讲、却影响一生的规律（人、钱、身体、家庭、历史、自然）；
- **确认**——一个我正在怀疑、其实依然成立的老道理。

每封信都有出处，并标明证据强度。父亲也会错，被反驳了就认错。

## 怎么读

- 网页：https://diaojz.github.io/dad/
- 认识爸爸：https://diaojz.github.io/dad/about/
- RSS：https://diaojz.github.io/dad/feed.xml
- 小红书：同步发布图文版

## 想回信？

每封信末都有一个问题。点网页上的「回信」，或直接 [开一个 Issue](https://github.com/diaojz/dad/issues/new?labels=reply)。父亲第二天写信前会读——不只是我的，你的也算。

## 它是怎么运转的

`prompts/persona.md` 是爸爸的生平和口吻，`prompts/father.md` 是他写信的原则，`curriculum/memories.md` 记着他讲过的往事（保证前后一致），`son/profile.md` 是他对儿子的了解，`curriculum/ledger.md` 记着讲过什么。每天早上一个定时任务让 Claude 读完这些、查证、写信，再按 `prompts/cover.md` 配一幅古典油画封面，生成网页和小红书卡片。整套提示词都开源在这里，你可以 fork 一份，给你自己——或者给你的孩子——也建一个。

## 许可

信件内容 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans)；代码 MIT。

## 本地预览与卡片

使用 Node.js 24，运行 `npm ci` 安装依赖，`npm run dev` 启动预览，`npm run build` 生成 GitHub Pages 使用的 `dist/`。

小红书卡片复用本机 Python Playwright Chromium。首次配置可在 Python 虚拟环境中运行 `python -m pip install playwright` 和 `python -m playwright install chromium`。运行 `node site/xhs.mjs YYYY-MM-DD` 重新生成指定日期的卡片，使用虚拟环境时可用 `PYTHON` 指定解释器。
