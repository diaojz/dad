import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';

export async function readLetter(path) {
  const file = await readFile(path, 'utf8');
  const match = file.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error(path + ' 缺少 YAML frontmatter');
  // Keep unquoted dates and numeric-looking strings as written.
  const data = parse(match[1], { schema: 'failsafe' });
  const fields = ['no', 'date', 'title', 'hook', 'domain', 'kind'];
  if (!data || fields.some(key => typeof data[key] !== 'string' || !data[key].trim()) ||
      !/^[1-9]\d*$/.test(data.no) || !Number.isSafeInteger(Number(data.no)) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
      new Date(data.date).toJSON()?.slice(0, 10) !== data.date ||
      !['校准', '补全', '确认'].includes(data.kind) || !match[2].trim()) {
    throw new Error(path + ' 的信件字段或正文无效');
  }
  return { ...Object.fromEntries(fields.map(key => [key, data[key].trim()])), cover: typeof data.cover === 'string' ? data.cover.trim() : undefined, body: match[2] };
}

export async function loadLetters(root) {
  const directory = join(root, 'letters');
  const files = await readdir(directory).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const letters = await Promise.all(files.filter(file => file.endsWith('.md')).map(async file => {
    const slug = file.slice(0, -3);
    return { ...await readLetter(join(directory, file)), slug };
  }));
  return letters.sort((a, b) => b.date.localeCompare(a.date) || Number(b.no) - Number(a.no));
}
