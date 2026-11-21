import { mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
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
const signature = `爸爸的信 · 第${letter.no}封`;
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
  if (!requiredText(heading) || !requiredText(text) || (cover && !requiredText(card.kicker))) {
    throw new Error(`第 ${index + 1} 张卡片缺少文案`);
  }
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${esc(heading)}</title>
<style>${css}</style><body><main class="${card.type}"><div class="layout"><div class="copy">
${cover ? `<p class="kicker">${esc(card.kicker)}</p>` : ''}
<h1>${esc(heading)}</h1><p class="text">${esc(text)}</p></div></div>
<footer>${signature}</footer></main></body></html>`;
});

const staging = await mkdtemp(join(directory, '.render-'));
try {
  const result = spawnSync(process.env.PYTHON ?? 'python3', [join(here, 'xhs-shot.py'), staging], {
    input: JSON.stringify(pages),
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit']
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Chromium 卡片渲染失败');
  const meta = {
    title: post.title,
    content: post.content,
    topics: [...new Set([...post.content.matchAll(/(?:^|\s)#([^#\s]+)/gu)].map(match => match[1]))],
    images: files.map(file => join(directory, file)),
    settings: post.settings ?? {}
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
