import { mkdir, rm, writeFile, copyFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import sharp from 'sharp';
import { coverFile, fontCSS, issue, titleLines } from './visuals.mjs';
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

const github = 'https://github.com/diaojz/dad';
const domains = new Map(Object.entries({
  mind: '思维', craft: '手艺', work: '工作', money: '钱', body: '身体', people: '人',
  family: '家', world: '世界', learn: '学习', self: '自我', nature: '自然'
}));
const domainName = code => domains.get(code) ?? code;
const coverPath = (letter, thumb = false) =>
  BASE + 'covers/' + (thumb ? 'thumbs/' : '') + encodeURIComponent(letter.slug) + '.jpg';
const previewStyle = preview => preview ? ` style="--preview: url('data:image/jpeg;base64,${preview}')"` : '';
const imageTag = (letter, thumb = false) => letter.hasCover
  ? `<img src="${coverPath(letter, thumb)}" decoding="async" alt="${thumb ? '' : esc(letter.cover ?? '')}" ${thumb ? 'loading="lazy"' : 'fetchpriority="high"'}>`
  : `<span class="cover-placeholder" aria-hidden="true"><span>${issue(letter)}</span></span>`;

function page(title, content, letter, { reading = false, father = false } = {}) {
  const socialImage = letter?.hasCover ? origin + coverPath(letter) : null;
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="icon" href="${BASE}envelope.svg" type="image/svg+xml">
<link rel="stylesheet" href="${fontCSS}"><link rel="stylesheet" href="${BASE}style.css">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(letter?.hook ?? subtitle)}">
<meta name="twitter:card" content="${socialImage ? 'summary_large_image' : 'summary'}">
${socialImage ? `<meta property="og:image" content="${esc(socialImage)}"><meta name="twitter:image" content="${esc(socialImage)}">` : ''}
<link rel="alternate" type="application/rss+xml" title="${name}" href="${BASE}feed.xml"></head>
<body><div class="frame"><header class="masthead">${reading ? '<div class="reading-progress" aria-hidden="true"></div>' : ''}<a class="brand" href="${BASE}"><img src="${BASE}envelope.svg" alt="">${name}</a>
<nav aria-label="站点"><a href="${BASE}#archive">往期</a><a href="${BASE}about/"${father ? ' aria-current="page"' : ''}>爸爸</a><a href="${BASE}feed.xml">RSS</a><a href="${github}">GitHub</a></nav></header>
<main>${content}</main><footer class="site-footer"><p>一个 AI 扮演的父亲，每天写给一个写了十几年代码的儿子，只讲一个认知。</p>
<a href="${github}/blob/main/prompts/father.md">父亲的性格写在 prompts/father.md，全部开源 ↗</a></footer></div></body></html>`;
}

const details = letter => `<p class="details">[ 第 ${issue(letter)} 封 · <time datetime="${esc(letter.date)}">${letter.date.replaceAll('-', '.')}</time> · ${esc(domainName(letter.domain))} · ${esc(letter.kind)} ]</p>`;
const quote = letter => `<blockquote class="hook">“${esc(letter.hook)}”</blockquote>`;
const chineseDate = date => {
  const [year, month, day] = date.split('-').map(Number);
  return `${year} 年 ${month} 月 ${day} 日`;
};

function postmark(letter) {
  return `<svg class="postmark" viewBox="0 0 120 120" role="img" aria-label="县城 · ${letter.date.replaceAll('-', '.')} · 第 ${issue(letter)} 封">
<circle cx="60" cy="60" r="56"/><circle cx="60" cy="60" r="50"/>
<path d="M22 49h76M22 72h76"/>
<text x="60" y="40">县 城</text><text x="60" y="65">${letter.date.replaceAll('-', '.')}</text>
<text x="60" y="88">第 ${issue(letter)} 封</text></svg>`;
}

function home(letters) {
  const latest = letters[0];
  if (!latest) return page(name, '<section class="hero"><h1>第一封信还在路上</h1></section><section id="archive"><h2>往期来信</h2></section>');
  const months = Map.groupBy(letters, letter => letter.date.slice(0, 7));
  const filters = [...new Set(letters.map(letter => letter.domain))].sort();
  return page(name, `<section class="hero">
<a class="art hero-art"${previewStyle(latest.preview)} href="${letterPath(latest)}" aria-label="拆信：${esc(latest.title)}">${imageTag(latest)}</a>
<div class="hero-copy">${postmark(latest)}
<p class="details">${esc(domainName(latest.domain))} · ${esc(latest.kind)}</p>
<h1>${titleLines(latest.title, esc)}</h1>${quote(latest)}
<a class="button" href="${letterPath(latest)}">拆信 <span aria-hidden="true">↗</span></a></div></section>
<section class="archive" id="archive"><div class="archive-head"><h2>往期来信</h2>
<div id="domain" class="filters" aria-label="按领域筛选" hidden><button type="button" data-filter="" aria-pressed="true">全部</button>${filters.map(code => `<button type="button" data-filter="${esc(code)}" aria-pressed="false">${esc(domainName(code))}</button>`).join('')}</div></div>
${[...months].map(([month, group]) => `<section class="month"><h3>${month.slice(0, 4)} 年 ${Number(month.slice(5))} 月</h3>
<ul>${group.map(letter => `<li data-domain="${esc(letter.domain)}"><a href="${letterPath(letter)}">
<div class="art thumbnail"${previewStyle(letter.preview)}>${imageTag(letter, true)}</div>
<div class="envelope"><span class="domain-stamp">${esc(domainName(letter.domain))}</span><p class="details archive-details"><span>第 ${issue(letter)} 封</span><time datetime="${letter.date}">${letter.date.replaceAll('-', '.')}</time></p><strong>${esc(letter.title)}</strong></div></a></li>`).join('')}</ul></section>`).join('')}</section>
<script src="${BASE}archive.js" defer></script>`, latest);
}

function renderSources(tokens) {
  return marked.parser(tokens.map(token => {
    if (token.type !== 'list') return token;
    return { ...token, ordered: true };
  })).replace(/证据强度：(?:<strong>)?(有争议|强|中|判断)(?:<\/strong>)?|我的判断/g,
    (match, strength) => `<span class="evidence evidence-${strength ?? '判断'}">${strength ?? match}</span>`);
}

function renderLetter(letter, previous, next) {
  const reply = new URL(github + '/issues/new');
  reply.searchParams.set('labels', 'reply');
  reply.searchParams.set('title', `回信：第${letter.no}封 ${letter.title}`);
  const tokens = marked.lexer(letter.body);
  const cards = new Map();
  const prose = [];
  const sources = [];
  let signed = false;
  const postscripts = [];
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
    if (section !== sources && token.type === 'paragraph' && token.text.trim() === '爸爸') {
      signed = true;
      continue;
    }
    if (section !== sources && signed && token.type === 'paragraph' && /^又\s*[：:]/u.test(token.text)) {
      postscripts.push(...token.tokens);
      continue;
    }
    section.push(token);
  }
  const minutes = Math.max(1, Math.ceil(
    [prose, ...cards.values()].flat().map(token => token.text ?? '').join('')
      .replace(/[^\p{Letter}\p{Number}]/gu, '').length / 350
  ));
  const neighbor = (item, label) => item ? `<a href="${letterPath(item)}"><div class="art thumbnail">${imageTag(item, true)}</div><span><small>${label}</small>${esc(item.title)}</span></a>` : '';
  const neighbors = previous || next ? `<nav class="neighbors" aria-label="相邻信件">${neighbor(previous, '上一封')}${neighbor(next, '下一封')}</nav>` : '';
  return page(letter.title + ' · ' + name, `<article class="letter">
<div class="art letter-art"${previewStyle(letter.preview)}>${imageTag(letter)}</div>
<header class="letter-head">${details(letter)}<h1>${titleLines(letter.title, esc)}</h1>${quote(letter)}</header>
<div class="letter-paper">
<div class="prose">${marked.parser(prose).replace(/^<p>儿子[：:]<\/p>/, '<p class="salutation">儿子：</p>')}</div>
${[...cards].map(([heading, body]) => {
    const question = heading === '我想问你';
    return `<section class="note prose ${question ? 'postcard' : 'action'}"><h2>${heading}</h2>${marked.parser(body)}
${question ? `<a class="stamp" href="${esc(reply.href)}">回信 ↗</a>` : ''}</section>`;
  }).join('')}
${signed ? `<div class="signature"><span>爸爸</span><time datetime="${letter.date}">${chineseDate(letter.date)}</time></div>` : ''}
${postscripts.length ? `<aside class="postscript"><span aria-hidden="true">又</span><p>${marked.parser([{ type: 'paragraph', tokens: postscripts }]).replace(/^<p>又\s*[：:]\s*/u, '').replace(/<\/p>\s*$/, '')}</p></aside>` : ''}
<p class="reading-meta">这封信写于 <time datetime="${letter.date}">${chineseDate(letter.date)}</time> · 约 ${minutes} 分钟读完</p>
${sources.length ? `<section class="sources">${renderSources(sources)}</section>` : ''}
</div></article>${neighbors}<script src="${BASE}reading.js" defer></script>`, letter, { reading: true });
}

const introduction = '我五八年生在江南一个小县城。年轻时修抽水机，后来进厂做电视。我那时觉得县里人买不起彩电，没过几年，厂倒了，我也下了岗。后来自己开铺子，又到职校教了几年书。现在我跟你妈还住老房子，阳台种点辣椒和葱，周三去图书馆。你给我装的 AI，我常用。它说哪篇论文讲过，我还是要翻到那篇才算数。日子过到这把年纪，有些事想起来，就写给你。';

const life = [
  ['1958', '生在江南一座小县城，四个孩子里排老二。'],
  ['1975', '高中毕业下乡，在公社农机站帮人修柴油机和抽水机。'],
  ['1978', '去省城读无线电技术，常在图书馆翻《无线电》合订本。'],
  ['1982', '回县里的无线电厂做收音机和黑白电视，跟孙师傅学会用万用表。'],
  ['1985', '和县城小学的语文老师结婚。'],
  ['1988', '儿子出生，后来常把他架在脖子上去河边看人钓鱼。'],
  ['1997', '无线电厂倒闭，三十九岁下岗。'],
  ['1998–2012', '在县城开家电维修铺，从修电视一路修到电脑和手机。'],
  ['2013–2018', '在县职业中专教电子电工，才知道会做和会教是两回事。'],
  ['2018', '六十岁退休，阳台上种起辣椒和葱。'],
  ['2026', '每周三去县图书馆，也在老房子的窗边给儿子写信。']
];

function fatherPage(preview) {
  return `<article class="father"><header class="father-head"><h1>爸爸是谁</h1></header>
<div class="father-opening">
${preview ? `<figure class="art father-art"${previewStyle(preview)}><img src="${BASE}father.jpg" width="1200" height="900" decoding="async" alt="冬日下午，爸爸背对着我们，在县城老房子的窗边写信"></figure>` : ''}
<div class="letter-paper father-intro prose"><p class="salutation">儿子：</p><p>${introduction}</p></div></div>
<section class="father-history"><h2>这些年</h2><ol class="timeline">${life.map(([year, story]) => `<li><span>${year}</span><p>${story}</p></li>`).join('')}</ol></section>
<p class="father-disclosure">爸爸是 AI 扮演的虚构人物。他的往事是虚构的，信里引用的研究都是真的。性格写在 <a href="${github}/tree/main/prompts">prompts/</a> 里，全部开源。</p></article>`;
}

async function makePreview(source) {
  const preview = await sharp(source).resize(24).jpeg({ quality: 55 }).toBuffer();
  return preview.toString('base64');
}

async function write(path, content) {
  const target = join(dist, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

const letters = await loadLetters(root);

await rm(dist, { force: true, recursive: true });
await mkdir(join(dist, 'covers', 'thumbs'), { recursive: true });
await Promise.all(letters.map(async letter => {
  const source = coverFile(root, letter.slug);
  const target = join(dist, 'covers', letter.slug + '.jpg');
  try {
    await copyFile(source, target);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  await sharp(source).resize(640, null, { withoutEnlargement: true })
    .jpeg({ quality: 80 }).toFile(join(dist, 'covers', 'thumbs', letter.slug + '.jpg'));
  letter.preview = await makePreview(source);
  letter.hasCover = true;
}));
await copyFile(join(here, 'static', 'envelope.svg'), join(dist, 'envelope.svg'));
await write('index.html', home(letters));
const portrait = join(here, 'static', 'father.jpg');
let fatherPreview;
try {
  await copyFile(portrait, join(dist, 'father.jpg'));
  fatherPreview = await makePreview(portrait);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await write('about/index.html', page('爸爸是谁 · ' + name, fatherPage(fatherPreview), null, { father: true }));
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
for (const asset of ['style.css', 'archive.js', 'reading.js']) await copyFile(join(here, asset), join(dist, asset));
console.log(`已构建 ${letters.length} 封信 · ${BASE} · ${dist}`);
