"""章节分块引擎 — 自动检测并拆分小说章节"""

import re
from typing import List, Tuple

# 章节标题匹配模式（按优先级排列）
CHAPTER_PATTERNS = [
    # "第X章" — 阿拉伯数字（中英文括号）
    re.compile(r"^第[0-9]+章\s*.*$", re.MULTILINE),
    # "第一章" — 中文数字
    re.compile(r"^第[一二三四五六七八九十百千零]+章\s*.*$", re.MULTILINE),
    # "Chapter X"
    re.compile(r"^Chapter\s+[0-9]+\s*.*$", re.MULTILINE | re.IGNORECASE),
    # "CHAPTER X"
    re.compile(r"^CHAPTER\s+[0-9]+\s*.*$", re.MULTILINE),
]


def split_chapters(text: str) -> List[Tuple[str, str]]:
    """将小说文本按章节拆分。

    Args:
        text: 小说全文文本

    Returns:
        List[Tuple[str, str]]: 每个元素为 (章节标题, 章节内容) 的列表。
        章节内容已去除首尾空白。如无章节标记，整篇作为「全文」返回。
    """
    if not text.strip():
        return []

    # 找到所有章节标题位置
    matches: List[Tuple[int, str]] = []
    for pattern in CHAPTER_PATTERNS:
        found = list(pattern.finditer(text))
        for m in found:
            pos = m.start()
            title = m.group().strip()
            # 避免重复匹配
            if not any(existing_pos == pos for existing_pos, _ in matches):
                matches.append((pos, title))

    if not matches:
        return [("全文", text.strip())]

    # 按位置排序
    matches.sort(key=lambda x: x[0])

    chapters: List[Tuple[str, str]] = []
    for i, (pos, title) in enumerate(matches):
        start = pos + len(title)
        end = matches[i + 1][0] if i + 1 < len(matches) else len(text)
        content = text[start:end].strip()
        chapters.append((title, content))

    return chapters
