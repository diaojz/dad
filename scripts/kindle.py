#!/usr/bin/env python3
"""把 RSS 里的全部信合成一本《爸爸的信》AZW3，供 USB 连线拷进 Kindle。
用法: kindle.py [feed 路径或 URL]   生成书到 ~/.claude/scripts/dad-daily/kindle/
      kindle.py --copy [feed]       生成后拷到已挂载的 Kindle（/Volumes/Kindle/documents）
默认读本地 dist/feed.xml（daily.sh 构建后）。按日期正序，新信在书末，Kindle 打开即续读。"""
import html, shutil, subprocess, sys, tempfile, urllib.request, xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = Path.home() / ".claude/scripts/dad-daily/kindle/爸爸的信.azw3"
KINDLE = Path("/Volumes/Kindle/documents")

args = sys.argv[1:]
copy = "--copy" in args
src = next((a for a in args if not a.startswith("--")), str(ROOT / "dist/feed.xml"))
raw = urllib.request.urlopen(src).read() if src.startswith("http") else Path(src).read_bytes()
items = sorted(ET.fromstring(raw).findall("./channel/item"), key=lambda i: i.findtext("guid"))
if not items:
    sys.exit("feed 里没有信")

with tempfile.TemporaryDirectory() as tmp:
    body = []
    for item in items:
        date = item.findtext("guid").rstrip("/").rsplit("/", 1)[-1][:10]
        # 信里的 h2 降为 h3，避免进目录
        text = item.findtext("description").replace("<h2>", "<h3>").replace("</h2>", "</h3>")
        body.append(f"<h1>{html.escape(item.findtext('title'))}</h1>\n<p><em>{date}</em></p>\n{text}")
    src_html = Path(tmp, "letters.html")
    src_html.write_text("\n".join(body), encoding="utf-8")
    epub = Path(tmp, "letters.epub")
    subprocess.run(["pandoc", str(src_html), "-o", str(epub), "--toc", "--toc-depth=1",
                    "--split-level=1", "--metadata", "title=爸爸的信", "--metadata", "author=爸爸",
                    "--metadata", "lang=zh"], check=True, stderr=subprocess.DEVNULL)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ebook-convert", str(epub), str(OUT)], check=True, stdout=subprocess.DEVNULL)
print(f"已生成 {OUT}（{len(items)} 封）")

if copy:
    if not KINDLE.is_dir():
        sys.exit("没找到 /Volumes/Kindle：请用 USB 连上 Kindle 并在 Kindle 上确认「传输文件」")
    shutil.copy2(OUT, KINDLE / OUT.name)
    print(f"已拷入 Kindle：{KINDLE / OUT.name}，拔线后在书库里打开《爸爸的信》")
