"""测试章节分块引擎"""

from novel_to_script.chapter_splitter import split_chapters


class TestSplitChapters:
    def test_chinese_chapter_numbers(self):
        """中文"第X章"格式"""
        text = """第1章 初遇

张三走进了房间，看到里面坐着一个人。

第2章 对话

"你是谁？"张三问道。

第3章 真相

那人缓缓抬起头，露出熟悉的面容。"""

        chapters = split_chapters(text)
        assert len(chapters) == 3
        assert chapters[0][0] == "第1章 初遇"
        assert "张三走进了房间" in chapters[0][1]
        assert chapters[1][0] == "第2章 对话"
        assert chapters[2][0] == "第3章 真相"

    def test_chinese_numeric_chapter(self):
        """中文数字"第一章"格式"""
        text = """第一章 开始

故事从这里开始。

第二章 发展

故事继续发展。"""

        chapters = split_chapters(text)
        assert len(chapters) == 2
        assert chapters[0][0] == "第一章 开始"
        assert chapters[1][0] == "第二章 发展"

    def test_english_chapter(self):
        """英文 Chapter 格式"""
        text = """Chapter 1 The Beginning

It was a dark and stormy night.

Chapter 2 The Middle

The plot thickened.

Chapter 3 The End

All was resolved."""

        chapters = split_chapters(text)
        assert len(chapters) == 3
        assert chapters[0][0] == "Chapter 1 The Beginning"

    def test_no_chapters(self):
        """无章节标记时整篇作为一个章节"""
        text = "这是一段没有任何章节标记的文本。它应该作为一个整体返回。"

        chapters = split_chapters(text)
        assert len(chapters) == 1
        assert chapters[0][0] == "全文"

    def test_empty_text(self):
        """空文本返回空列表"""
        chapters = split_chapters("")
        assert len(chapters) == 0

    def test_chapter_strip_whitespace(self):
        """章节内容去除首尾空白"""
        text = """第1章 测试

  内容第一行
  内容第二行

第2章 测试2

  更多内容  """

        chapters = split_chapters(text)
        assert len(chapters) == 2
        # 不应包含多余的前后空白行
        assert not chapters[0][1].startswith("\n")
        assert not chapters[0][1].endswith("\n")

    def test_fewer_than_3_chapters_detection(self):
        """少于3章时正确返回章节数"""
        text = """第1章 孤章

只有一章的内容。"""

        chapters = split_chapters(text)
        assert len(chapters) == 1
