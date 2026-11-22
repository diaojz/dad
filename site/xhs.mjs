import { mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { coverFile, fontCSS, issue, titleLines } from './visuals.mjs';
import { readLetter } from './letters.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(process.env.DAD_ROOT ?? join(here, '..'));
const now = new Date();
const date = process.argv[2] ?? [now.getFullYear(), now.getMonth() + 1, now.getDate()]
  .map(value => String(value).padStart(2, '0')).join('-');
if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date).toJSON()?.slice(0, 10) !== date) {
  throw new Error('用法：node site/xhs.mjs [YYYY-MM-DD]');
}
const directory = join(root, 'xhs', date);
const post = JSON.parse(await readFile(join(directory, 'post.json'), 'utf8'));
const requiredText = value => typeof value === 'string' && Boolean(value.trim());
if (!requiredText(post.title) || !requiredText(post.content) ||
    !Array.isArray(post.cards) || !post.cards.length || post.cards.length > 18) {
  throw new Error('post.json 需要标题、正文和 1–18 张卡片');
}
if (!/^letters\/[^/\\]+\.md$/.test(post.letter ?? '')) throw new Error('post.json 的 letter 必须指向 letters/ 下的信件');
const letter = await readLetter(join(root, post.letter));
const signature = '城北 · 爸爸的信';
const painting = await readFile(coverFile(root, basename(post.letter, '.md'))).catch(error => {
  if (error.code === 'ENOENT') return null;
  throw error;
});
const artwork = painting
  ? `<div class="art"><img src="data:image/jpeg;base64,${painting.toString('base64')}" alt=""></div>`
  : `<div class="art placeholder"><span>${issue(letter)}</span></div>`;
const esc = value => value.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]);
const css = await readFile(join(here, 'xhs.css'), 'utf8');
const files = post.cards.map((_, index) => String(index + 1).padStart(2, '0') + '.png');
const pages = post.cards.map((card, index) => {
  if (!card || !['cover', 'body', 'action', 'question'].includes(card.type)) {
    throw new Error(`第 ${index + 1} 张卡片的 type 无效`);
  }
  const cover = card.type === 'cover';
  const heading = cover ? card.headline : card.heading;
  const text = cover ? card.sub : card.text;
  if (!requiredText(heading) || !requiredText(text)) {
    throw new Error(`第 ${index + 1} 张卡片缺少文案`);
  }
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${esc(heading)}</title>
<link rel="stylesheet" href="${fontCSS}"><style>${css}</style><body><main class="${card.type}">${artwork}${cover ? `<div class="postmark" aria-hidden="true"><span>县 城</span><span>${letter.date.replaceAll('-', '.')}</span><span>第 ${issue(letter)} 封</span></div>` : ''}<div class="layout"><div class="copy">
${cover ? `<p class="kicker">${signature} · 第${letter.no}封</p>` : ''}
<h1>${cover ? titleLines(heading, esc) : esc(heading)}</h1><p class="text">${esc(text)}</p></div></div>
<footer>${signature}</footer></main></body></html>`;
});

const staging = await mkdtemp(join(directory, '.render-'));
try {
  await writeFile(join(staging, 'pages.json'), JSON.stringify(pages));
  await new Promise((resolve, reject) => {
    const renderer = spawn(process.env.PYTHON ?? 'python3', [join(here, 'xhs-shot.py'), staging], {
      stdio: ['ignore', 'inherit', 'inherit'],
      timeout: 120_000
    });
    renderer.once('error', reject);
    renderer.once('close', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Chromium 卡片渲染失败（${signal ?? code}）`));
    });
  });
  const meta = {
    title: post.title,
    content: post.content,
    topics: [...new Set([...post.content.matchAll(/(?:^|\s)#([^#\s]+)/gu)].map(match => match[1]))],
    images: files.map(file => join(directory, file)),
    settings: post.settings ?? { collection: "爸爸的信", original: true, ai_synthetic: true }
  };
  await writeFile(join(staging, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  for (const file of files) await rename(join(staging, file), join(directory, file));
  await rename(join(staging, 'meta.json'), join(directory, 'meta.json'));
  for (const file of await readdir(directory)) {
    if (/^\d{2}\.png$/.test(file) && !files.includes(file)) await rm(join(directory, file));
  }
  console.log(`已渲染 ${files.length} 张卡片 · ${directory}`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
