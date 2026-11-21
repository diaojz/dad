#!/usr/bin/env python3
"""把 RSS 里还没推过的信做成 EPUB 发到 Kindle。
用法: kindle.py [feed 路径或 URL] [--dry-run]
默认读本地 dist/feed.xml（daily.sh 构建后），已发记录在 ~/.claude/scripts/dad-daily/kindle-sent.txt。"""
import subprocess, sys, tempfile, urllib.request, xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEND = Path.home() / ".agents/skills/diao-kindle-send/scripts/send.py"
STATE = Path.home() / ".claude/scripts/dad-daily/kindle-sent.txt"

args = sys.argv[1:]
dry = "--dry-run" in args
src = next((a for a in args if not a.startswith("--")), str(ROOT / "dist/feed.xml"))
raw = urllib.request.urlopen(src).read() if src.startswith("http") else Path(src).read_bytes()
items = ET.fromstring(raw).findall("./channel/item")

sent = set(STATE.read_text().split()) if STATE.exists() else set()
todo = [i for i in reversed(items) if i.findtext("guid") not in sent]
if not todo:
    print("Kindle：没有新信"); sys.exit(0)

with tempfile.TemporaryDirectory() as tmp:
    for item in todo:
        guid, title = item.findtext("guid"), item.findtext("title")
        date = guid.rstrip("/").rsplit("/", 1)[-1][:10]
        html = Path(tmp, "letter.html")
        html.write_text(f"<h1>{title}</h1>\n{item.findtext('description')}", encoding="utf-8")
        epub = Path(tmp, f"爸爸的信 {date} {title}.epub")
        subprocess.run(["pandoc", str(html), "-o", str(epub), "--metadata", f"title={title}",
                        "--metadata", "author=爸爸", "--metadata", "lang=zh-CN",
                        "--metadata", f"date={date}"], check=True)
        subprocess.run([sys.executable, "-I", str(SEND), str(epub)] + (["--dry-run"] if dry else []), check=True)
        if not dry:
            STATE.parent.mkdir(parents=True, exist_ok=True)
            with STATE.open("a") as f: f.write(guid + "\n")
        print(f"Kindle：已发送 {title}")
