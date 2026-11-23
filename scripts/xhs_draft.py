#!/usr/bin/env python3
"""核对账号和发布页状态，存草稿后回读确认。"""

import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time

ACCOUNT = "城北 | AI Coding"
PUBLISH_URL = (
    "https://creator.xiaohongshu.com/publish/publish"
    "?from=homepage&target=image&source=official"
)
SESSION = ("--session", "xhspub")
PERSISTENT = ("--site-session", "persistent")
RESTORED_DRAFT = "发布页有恢复出来的草稿，未动，需人工处理"
RESTORED_DRAFT_EXIT = 73


def opencli(*args, env):
    result = subprocess.run(
        ["opencli", *args], capture_output=True, text=True, env=env, timeout=60
    )
    decoder = json.JSONDecoder()
    for output in (result.stdout, result.stderr):
        for match in re.finditer(r"(?m)^\s*\{", output):
            try:
                envelope, _ = decoder.raw_decode(output[match.start():].lstrip())
            except json.JSONDecodeError:
                continue
            if "ok" in envelope:
                if result.returncode == 0 and envelope["ok"] is True:
                    return envelope.get("data")
                raise RuntimeError(f"OpenCLI {args[1]} 失败：{envelope.get('error') or result.returncode}")
    detail = (result.stderr.strip() or result.stdout.strip()).splitlines()
    raise RuntimeError(f"OpenCLI {args[1]} 未返回 JSON：{detail[0] if detail else result.returncode}")


def draft_exists(title, image_count, env):
    drafts = opencli("xiaohongshu", "drafts", *PERSISTENT, env=env)
    if not isinstance(drafts, list):
        raise RuntimeError("草稿箱返回格式异常")
    return any(item.get("title") == title and item.get("images") == image_count for item in drafts)


def run_publisher(script, directory, env):
    source = script.read_text(encoding="utf-8")
    cleanup = '    for _ in range(0 if keep_cover else 12):'
    if cleanup not in source:
        if "close-btn" in source:
            raise RuntimeError("发布脚本的残留清理逻辑已变更，需人工核对")
        return subprocess.run(
            ["python3", str(script), str(directory), "--draft"], env=env, timeout=900
        )

    # 原脚本会再次打开编辑器。把清理区块替换为只读检查，保留本地脚本原样。
    start = source.index(cleanup)
    end = source.find("    # 分片送入", start)
    if end < 0:
        raise RuntimeError("无法定位发布脚本的残留清理区块")
    image_check = "document.querySelectorAll('.img-container').length"
    guard = (
        f"    if ev({image_check!r}) != '0':\n"
        f"        print({RESTORED_DRAFT!r}, file=sys.stderr)\n"
        f"        sys.exit({RESTORED_DRAFT_EXIT})\n\n"
    )
    guarded_source = source[:start] + guard + source[end:]
    with tempfile.TemporaryDirectory(prefix="dad-xhs-") as staging:
        guarded_script = Path(staging) / script.name
        guarded_script.write_text(guarded_source, encoding="utf-8")
        return subprocess.run(
            ["python3", str(guarded_script), str(directory), "--draft"], env=env, timeout=900
        )


def save_draft(directory):
    meta = json.loads((directory / "meta.json").read_text(encoding="utf-8"))
    title = meta.get("title") if isinstance(meta, dict) else None
    if not isinstance(title, str) or not title.strip():
        raise RuntimeError("meta.json 缺少有效的 title")
    image_count = sum(
        path.is_file() and re.fullmatch(r"[0-9]{2}\.png", path.name, re.IGNORECASE) is not None
        for path in directory.iterdir()
    )
    if not image_count:
        raise RuntimeError("找不到 NN.png 卡片")

    env = os.environ.copy()
    env.pop("OPENCLI_PROFILE", None)
    profiles = opencli("profile", "list", env=env)
    profile_id = next(
        (profile["contextId"] for profile in profiles["profiles"]
         if profile.get("connected") is True and profile.get("contextId")),
        None,
    )
    if profile_id is None:
        raise RuntimeError("Chrome 未打开或 OpenCLI 扩展未连接")
    env["OPENCLI_PROFILE"] = profile_id

    account = opencli("xiaohongshu", "whoami", *PERSISTENT, env=env)
    if not isinstance(account, dict) or account.get("username") != ACCOUNT:
        raise RuntimeError(f"小红书账号校验失败，需要登录「{ACCOUNT}」")
    if draft_exists(title, image_count, env):
        print("已在草稿箱")
        return

    script = Path(os.environ.get("XHS_PUBLISH_SCRIPT") or
                  "~/.claude/scripts/dad-daily/xhs-publish-cdp.py").expanduser()
    if not script.is_file():
        raise RuntimeError(f"找不到发布脚本：{script}")

    opencli("browser", "open", PUBLISH_URL, *SESSION, env=env)
    time.sleep(6)
    images = opencli("browser", "eval", "document.querySelectorAll('.img-container').length", *SESSION, env=env)
    if type(images) is not int or images != 0:
        raise RuntimeError(RESTORED_DRAFT)

    failure = "发布脚本结束，但草稿箱未找到匹配的草稿"
    try:
        result = run_publisher(script, directory, env)
        if result.returncode == RESTORED_DRAFT_EXIT:
            failure = RESTORED_DRAFT
        elif result.returncode:
            failure = f"发布脚本退出码 {result.returncode}，草稿箱未找到匹配的草稿"
    except subprocess.TimeoutExpired:
        failure = "发布脚本超过 900 秒，草稿箱未找到匹配的草稿"
        print("发布脚本超时，正在回读草稿箱", flush=True)
    except (OSError, RuntimeError) as error:
        failure = f"发布脚本启动失败：{error}"
        print(failure, flush=True)

    if not draft_exists(title, image_count, env):
        raise RuntimeError(failure)
    print("已确认草稿入箱")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("用法：python3 -I scripts/xhs_draft.py <xhs日期目录>")
    try:
        save_draft(Path(sys.argv[1]).resolve())
    except (RuntimeError, OSError, ValueError, KeyError, TypeError, subprocess.TimeoutExpired) as error:
        sys.exit(f"小红书：{error}")
