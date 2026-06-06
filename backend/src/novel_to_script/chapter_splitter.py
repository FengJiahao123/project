"""章节分块引擎 — 自动检测并拆分小说章节"""

import re
from typing import List, Tuple

# 章节标题匹配 — 不锚定行首，因为有些行格式是 "第X卷 ... 第X章 ...
CHAPTER_PATTERNS = [
    re.compile(r"第[0-9]+章[^\n]*"),
    re.compile(r"第[一二三四五六七八九十百千零]+章[^\n]*"),
    re.compile(r"Chapter\s+[0-9]+[^\n]*", re.IGNORECASE),
]

MIN_CONTENT_LENGTH = 100  # 章节内容少于 100 字视为目录/元数据条目

# 目录/元数据模式（匹配到则跳过）
SKIP_PATTERNS = [
    re.compile(r"最新章节"),
    re.compile(r"更新"),
    re.compile(r"^\s*$"),
]


def _is_valid_chapter(title: str) -> bool:
    """检查章节标题是否合法（非元数据行）。"""
    for pat in SKIP_PATTERNS:
        if pat.search(title):
            return False
    return True


def split_chapters(text: str) -> List[Tuple[str, str]]:
    """将小说文本按章节拆分。

    支持：
    - "第X卷 第X章" 格式（同一行有卷号和章号，匹配最后一个章号）
    - 阿拉伯数字和中文数字两种编号
    - 自动过滤目录条目（内容 < MIN_CONTENT_LENGTH）
    - 自动过滤元数据/最新章节提示行

    Args:
        text: 小说全文文本

    Returns:
        List[Tuple[str, str]]: (章节标题, 章节内容) 列表
    """
    if not text.strip():
        return []

    raw_matches: List[Tuple[int, str]] = []
    seen_positions: set[int] = set()

    for pattern in CHAPTER_PATTERNS:
        for m in pattern.finditer(text):
            pos = m.start()
            title = m.group().strip()
            if pos in seen_positions:
                continue
            if not _is_valid_chapter(title):
                continue
            seen_positions.add(pos)
            raw_matches.append((pos, title))

    if not raw_matches:
        return [("全文", text.strip())]

    raw_matches.sort(key=lambda x: x[0])

    # 提取内容并过滤
    chapters: List[Tuple[str, str]] = []
    for i, (pos, title) in enumerate(raw_matches):
        start = pos + len(title)
        # 找到下一个章节标记的位置
        end = raw_matches[i + 1][0] if i + 1 < len(raw_matches) else len(text)
        content = text[start:end].strip()

        # 跳过内容过短的目录条目和包含过多章节标题的目录区
        if len(content) < MIN_CONTENT_LENGTH:
            continue

        # 跳过目录区：如果内容中章节标题密度过高（每 30 字就有一个）
        title_count = 0
        for pat in CHAPTER_PATTERNS:
            title_count += len(pat.findall(content))
        content_len = max(1, len(content))
        if title_count > content_len / 30:
            continue

        chapters.append((title, content))

    if not chapters:
        return [("全文", text.strip())]

    return chapters
