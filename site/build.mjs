import { mkdir, readFile, rm, writeFile, copyFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { loadLetters } from './letters.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(process.argv[2] ?? join(here, '..'));
const dist = join(root, 'dist');
const baseSegment = (process.env.BASE ?? '/dad/').replace(/^\/+|\/+$/g, '');
const BASE = baseSegment ? '/' + baseSegment + '/' : '/';
const origin = process.env.SITE_ORIGIN ?? 'https://diaojz.github.io';
const name = '爸爸的信';
const subtitle = '每天一封，给一个写了十几年代码的儿子';
const esc = value => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[c]);
const letterPath = letter => BASE + 'letters/' + encodeURIComponent(letter.slug) + '/';
function markdownUrl(url) {
  if (/^\/(?!\/)/.test(url)) return url.startsWith(BASE) ? url : BASE + url.slice(1);
  return url;
}
const renderer = {
  html({ text }) { return esc(text); },
  link(token) { return new marked.Renderer().link.call(this, { ...token, href: markdownUrl(token.href) }); },
  image(token) { return new marked.Renderer().image.call(this, { ...token, href: markdownUrl(token.href) }); }
};
marked.use({ renderer });

function page(title, content) {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><link rel="stylesheet" href="${BASE}style.css">
<link rel="alternate" type="application/rss+xml" title="${name}" href="${BASE}feed.xml"></head>
<body><div class="frame"><header class="masthead"><a class="brand" href="${BASE}">${name}</a>
<nav aria-label="站点"><a href="${BASE}about/">关于</a><a href="${BASE}feed.xml">RSS</a></nav></header>
<main>${content}</main><footer>${subtitle}</footer></div></body></html>`;
}

const details = l => `<p class="details"><strong>第${esc(l.no)}封</strong><span>·</span><time datetime="${esc(l.date)}">${esc(l.date)}</time><span>·</span><span>${esc(l.domain)}</span><span>·</span><span>${esc(l.kind)}</span></p>`;

function home(letters) {
  const latest = letters[0];
  if (!latest) return page(name, `<section class="hero"><p class="subtitle">${subtitle}</p><h1>第一封信还在路上</h1></section>`);
  const months = Map.groupBy(letters.slice(1), letter => letter.date.slice(0, 7));
  const domains = [...new Set(letters.slice(1).map(letter => letter.domain))].sort();
  const archive = months.size ? `<section class="archive"><div class="archive-head"><h2>往期来信</h2>
<label>领域 <select id="domain"><option value="">全部</option>${domains.map(domain => `<option>${esc(domain)}</option>`).join('')}</select></label></div>
${[...months].map(([month, group]) => `<section class="month"><h3>${month.slice(0, 4)} 年 ${Number(month.slice(5))} 月</h3>
<ul>${group.map(letter => `<li data-domain="${esc(letter.domain)}">${details(letter)}<a href="${letterPath(letter)}">${esc(letter.title)}</a></li>`).join('')}</ul></section>`).join('')}</section>
<script src="${BASE}archive.js" defer></script>` : '';
  return page(name, `<section class="hero"><p class="subtitle">${subtitle}</p>${details(latest)}
<h1>${esc(latest.title)}</h1><p class="hook">${esc(latest.hook)}</p>
<a class="button" href="${letterPath(latest)}">读信</a></section>${archive}`);
}

function renderLetter(letter, previous, next) {
  const reply = new URL('https://github.com/diaojz/dad/issues/new');
  reply.searchParams.set('labels', 'reply');
  reply.searchParams.set('title', `回信：第${letter.no}封 ${letter.title}`);
  const tokens = marked.lexer(letter.body);
  const cards = new Map();
  const prose = [];
  const sources = [];
  let section = prose;
  for (const token of tokens) {
    if (token.type === 'heading' && token.depth <= 2) {
      section = token.depth === 2 && token.text === '出处' ? sources : prose;
      if (token.depth === 2 && ['今天做一件事', '我想问你'].includes(token.text)) {
        section = cards.get(token.text) ?? [];
        cards.set(token.text, section);
        continue;
      }
    }
    section.push(token);
  }
  const neighbor = (item, label) => item ? `<a href="${letterPath(item)}"><small>${label}</small>${esc(item.title)}</a>` : '<span></span>';
  return page(letter.title + ' · ' + name, `<article class="letter"><header>${details(letter)}<h1>${esc(letter.title)}</h1></header>
<div class="prose">${marked.parser(prose)}</div>
${[...cards].map(([heading, body]) => `<section class="note prose"><h2>${heading}</h2>${marked.parser(body)}
${heading === '我想问你' ? `<a class="button" href="${esc(reply.href)}">回信</a>` : ''}</section>`).join('')}
${sources.length ? `<section class="prose sources">${marked.parser(sources)}</section>` : ''}
</article><nav class="neighbors" aria-label="相邻信件">${neighbor(previous, '上一封')}${neighbor(next, '下一封')}</nav>`);
}

async function write(path, content) {
  const target = join(dist, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

const letters = await loadLetters(root);
const about = await readFile(join(root, 'README.md'), 'utf8');
await rm(dist, { force: true, recursive: true });
await write('index.html', home(letters));
await write('about/index.html', page('关于 · ' + name, `<article class="letter prose">${marked.parse(about)}</article>`));
await write('404.html', page('找不到这封信 · ' + name, `<section class="hero"><h1>找不到这封信</h1><a class="button" href="${BASE}">返回首页</a></section>`));
for (const [index, letter] of letters.entries()) {
  await write(join('letters', letter.slug, 'index.html'), renderLetter(letter, letters[index + 1], letters[index - 1]));
}
await write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>${name}</title><link>${esc(origin + BASE)}</link><description>${subtitle}</description><language>zh-CN</language>
${letters.map(letter => {
  const url = esc(origin + letterPath(letter));
  return `<item><title>${esc(letter.title)}</title><link>${url}</link><guid>${url}</guid><pubDate>${new Date(letter.date).toUTCString()}</pubDate><description>${esc(marked.parse(letter.body))}</description></item>`;
}).join('\n')}</channel></rss>`);
for (const asset of ['style.css', 'archive.js']) await copyFile(join(here, asset), join(dist, asset));
console.log(`已构建 ${letters.length} 封信 · ${BASE} · ${dist}`);
