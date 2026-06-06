"""测试章节分块引擎"""

from novel_to_script.chapter_splitter import split_chapters


def _pad(text: str, target: int = 110) -> str:
    """Pad text to reach minimum content length."""
    if len(text) >= target:
        return text
    return text + "\n" + "X" * (target - len(text))


class TestSplitChapters:
    def test_chinese_chapter_numbers(self):
        """中文'第X章'格式"""
        text = f"""第1章 初遇

{_pad('张三走进了房间，看到里面坐着一个人。')}

第2章 对话

{_pad('"你是谁？"张三问道。')}

第3章 真相

{_pad('那人缓缓抬起头，露出熟悉的面容。')}"""

        chapters = split_chapters(text)
        assert len(chapters) == 3
        assert chapters[0][0] == "第1章 初遇"
        assert chapters[1][0] == "第2章 对话"
        assert chapters[2][0] == "第3章 真相"

    def test_chinese_numeric_chapter(self):
        """中文数字'第一章'格式"""
        text = f"""第一章 开始

{_pad('故事从这里开始。')}

第二章 发展

{_pad('故事继续发展。')}"""

        chapters = split_chapters(text)
        assert len(chapters) == 2
        assert chapters[0][0] == "第一章 开始"
        assert chapters[1][0] == "第二章 发展"

    def test_english_chapter(self):
        """英文 Chapter 格式"""
        text = f"""Chapter 1 The Beginning

{_pad('It was a dark and stormy night.')}

Chapter 2 The Middle

{_pad('The plot thickened.')}

Chapter 3 The End

{_pad('All was resolved.')}"""

        chapters = split_chapters(text)
        assert len(chapters) == 3
        assert chapters[0][0] == "Chapter 1 The Beginning"

    def test_volume_prefix_format(self):
        """'第一卷 笼中雀 第一章 惊蛰' 格式 — 同一行有卷号和章号"""
        text = f"""第一卷 笼中雀 第一章 惊蛰

{_pad('二月二，龙抬头。陈平安天没亮就起床。')}

第一卷 笼中雀 第二章 开门

{_pad('陈平安推开门，阳光刺眼。')}"""

        chapters = split_chapters(text)
        assert len(chapters) == 2
        assert "第一章" in chapters[0][0] or "惊蛰" in chapters[0][0]
        assert "第二章" in chapters[1][0] or "开门" in chapters[1][0]

    def test_skips_short_content(self):
        """内容不足100字的章节被过滤"""
        text = f"""第1章 短章

短内容。

第2章 正常章

{_pad('这是正常长度的章节内容。')}"""

        chapters = split_chapters(text)
        assert len(chapters) == 1
        assert "第2章" in chapters[0][0]

    def test_skips_update_metadata(self):
        """跳过'最新章节：第73章'这样的元数据行"""
        text = f"""最新章：第99章 结局

全书完。

第一章 开始

{_pad('故事开始于一个遥远的小镇。')}"""

        chapters = split_chapters(text)
        assert len(chapters) == 1
        assert "第一章" in chapters[0][0]

    def test_no_chapters(self):
        """无章节标记时整篇作为一个章节"""
        text = _pad("这是一段没有任何章节标记的文本。")
        chapters = split_chapters(text)
        assert len(chapters) == 1
        assert chapters[0][0] == "全文"

    def test_empty_text(self):
        """空文本返回空列表"""
        chapters = split_chapters("")
        assert len(chapters) == 0

    def test_chapter_strip_whitespace(self):
        """章节内容去除首尾空白"""
        text = f"""第1章 测试

  内容第一行
  内容第二行
{_pad('')}

第2章 测试2

{_pad('更多内容。')}"""

        chapters = split_chapters(text)
        assert len(chapters) == 2
        assert not chapters[0][1].startswith("\n")
        assert not chapters[0][1].endswith("\n")

    def test_fewer_than_3_chapters_detection(self):
        """少于3章时正确返回章节数"""
        text = f"""第1章 孤章

{_pad('只有一章的内容。')}"""

        chapters = split_chapters(text)
        assert len(chapters) == 1
