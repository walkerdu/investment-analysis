#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
sync-pages.py — 根据 config.json 把每个 page 的 source 文件同步到主站内的 path 位置。

用法：
    ./sync-pages.py            # 增量同步（仅源比目标新时复制）
    ./sync-pages.py --force    # 强制全量复制
    ./sync-pages.py --check    # 仅检查，不复制（dry run）

依赖：仅 Python 3 标准库。
"""
import argparse
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG = os.path.join(HERE, "config.json")
PAGES_DIR = os.path.join(HERE, "pages")


def load_config():
    if not os.path.isfile(CONFIG):
        sys.exit("✗ 找不到 config.json: {}".format(CONFIG))
    with open(CONFIG, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    ap = argparse.ArgumentParser(description="同步分析页面到主站 pages/ 目录")
    ap.add_argument("--force", action="store_true", help="强制全量复制")
    ap.add_argument("--check", action="store_true", help="仅检查，不复制（dry run）")
    args = ap.parse_args()

    cfg = load_config()
    pages = cfg.get("pages", [])
    if not pages:
        print("config.json 中没有 pages 条目。")
        return

    os.makedirs(PAGES_DIR, exist_ok=True)

    copied = skipped = missing = 0
    for p in pages:
        pid = p.get("id", "")
        title = p.get("title", pid)
        source = p.get("source", "")
        relpath = p.get("path", "")

        if not source or not relpath:
            print("✗ [{}] 缺少 source/path 字段".format(pid))
            missing += 1
            continue

        # 安全：path 必须落在 pages/ 下，禁止越界（如 ../）
        dest = os.path.normpath(os.path.join(HERE, relpath))
        try:
            common = os.path.commonpath([dest, PAGES_DIR])
        except ValueError:
            common = ""
        if common != PAGES_DIR:
            print("✗ [{}] path 不在 pages/ 下: {}".format(pid, relpath))
            missing += 1
            continue

        if not os.path.isfile(source):
            print("✗ [{}] 源文件不存在: {}".format(pid, source))
            missing += 1
            continue

        os.makedirs(os.path.dirname(dest), exist_ok=True)

        need_copy = args.force or \
                    not os.path.isfile(dest) or \
                    os.path.getmtime(source) > os.path.getmtime(dest)

        if args.check:
            action = "将复制" if need_copy else "已最新"
            print("DRY  {} : {}  ←  {}".format(action, title, source))
            continue

        if need_copy:
            # 读取源文件并注入 page-enhance.js（左侧站点导航 + 右侧 TOC）
            with open(source, 'r', encoding='utf-8') as f:
                content = f.read()
            if 'page-enhance.js' not in content and '</body>' in content:
                content = content.replace('</body>',
                    '<script src="../assets/page-enhance.js"></script>\n</body>')
            with open(dest, 'w', encoding='utf-8') as f:
                f.write(content)
            shutil.copystat(source, dest)
            print("✓ 已同步: {}".format(title))
            copied += 1
        else:
            print("· 已最新: {}".format(title))
            skipped += 1

    print("")
    print("完成：复制 {} · 跳过 {} · 缺失 {}".format(copied, skipped, missing))
    sys.exit(2 if missing else 0)


if __name__ == "__main__":
    main()
