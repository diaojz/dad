import { join } from 'node:path';

export const fontCSS = 'https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-webfont@1.7.0/lxgwwenkaiscreenr.css';
export const coverFile = (root, slug) => join(root, 'site', 'static', 'covers', slug + '.jpg');
export const issue = letter => String(letter.no).padStart(3, '0');

export function titleLines(title, escape) {
  const parts = title.match(/^([^，]{2,7}，)([^，]{2,8})$/u);
  if (!parts) return escape(title);
  return parts.slice(1).map(part => `<span class="title-line">${escape(part)}</span>`).join('');
}
