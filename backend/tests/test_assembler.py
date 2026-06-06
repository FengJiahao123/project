"""测试剧本组装器"""

import pytest
from novel_to_script.assembler import assemble_script, to_yaml, merge_chapter_result
from novel_to_script.models import (
    Meta, Character, Scene, Location, ActionElement, DialogueElement, Script
)


class TestMergeChapterResult:
    def test_new_character_gets_sequential_id(self):
        """已有角色 char_001, char_002，新角色应分配 char_003"""
        existing = [
            Character(id="char_001", name="张三", role="主角", description="..."),
            Character(id="char_002", name="李四", role="配角", description="..."),
        ]
        new_chars = [
            Character(id="char_001", name="王五", role="龙套", description="新角色"),
        ]
        new_scenes: list[Scene] = []

        merged, scenes = merge_chapter_result(existing, new_chars, new_scenes)
        assert len(merged) == 3
        assert merged[2].id == "char_003"
        assert merged[2].name == "王五"

    def test_existing_character_reuses_id(self):
        """名称匹配的已有角色 → 复用已有 ID，不新增"""
        existing = [
            Character(id="char_001", name="陈平安", role="主角", description="少年"),
        ]
        new_chars = [
            Character(id="char_001", name="陈平安", role="主角", description="同一人"),
            Character(id="char_002", name="宁姚", role="主角", description="少女"),
        ]
        new_scenes: list[Scene] = []

        merged, scenes = merge_chapter_result(existing, new_chars, new_scenes)
        # 陈平安 复用已有 ID，宁姚 新分配 → 共 2 个
        assert len(merged) == 2
        assert merged[0].id == "char_001"
        assert merged[0].name == "陈平安"
        assert merged[1].name == "宁姚"
        assert merged[1].id == "char_002"

    def test_scene_references_remapped(self):
        """场景中 characters_present 和 dialogue.speaker 的 ID 应被更新"""
        existing = [
            Character(id="char_001", name="张三", role="主角", description="..."),
        ]
        new_chars = [
            Character(id="char_001", name="张三", role="主角", description="..."),
            Character(id="char_002", name="李四", role="配角", description="..."),
        ]
        # 李四在新章节中 ID 为 char_002，但这是第一次出现
        new_scenes = [
            Scene(
                scene_number=1,
                location=Location(name="某地", time="昼", description=""),
                characters_present=["char_002"],  # 旧 ID → 应映射为 char_002（恰好不变）
                elements=[
                    DialogueElement(
                        type="dialogue",
                        speaker="char_001",  # 旧 ID → 应映射为 char_001
                        lines=["你好"],
                    ),
                ],
            ),
        ]

        merged, scenes = merge_chapter_result(existing, new_chars, new_scenes)
        # 张三 char_001（复用），李四 → char_002（新分配）
        assert len(merged) == 2
        # 场景引用应正确
        assert scenes[0].characters_present == ["char_002"]
        assert scenes[0].elements[0].speaker == "char_001"

    def test_cross_chapter_collision_resolved(self):
        """模拟真实跨章碰撞：ch1 char_002=刘羡阳, ch3 char_002=宁姚"""
        # ch1 后的已累积角色
        existing = [
            Character(id="char_001", name="陈平安", role="主角", description="..."),
            Character(id="char_002", name="刘羡阳", role="配角", description="..."),
        ]
        # ch3 LLM 返回的角色（宁姚被标为 char_002，冲突！）
        new_chars = [
            Character(id="char_001", name="陈平安", role="主角", description="..."),
            Character(id="char_002", name="宁姚", role="主角", description="青衣少女"),
        ]
        new_scenes = [
            Scene(
                scene_number=1,
                location=Location(name="客栈", time="昼", description=""),
                characters_present=["char_001", "char_002"],
                elements=[
                    DialogueElement(
                        type="dialogue",
                        speaker="char_002",
                        lines=["我叫宁姚。"],
                    ),
                ],
            ),
        ]

        merged, scenes = merge_chapter_result(existing, new_chars, new_scenes)

        # 陈平安 → char_001（复用），宁姚 → char_003（新分配，不是 char_002！）
        assert len(merged) == 3
        assert merged[0].id == "char_001"  # 陈平安
        assert merged[1].id == "char_002"  # 刘羡阳（保持）
        assert merged[2].id == "char_003"  # 宁姚（新 ID！）
        assert merged[2].name == "宁姚"

        # 场景引用应指向新 ID char_003
        assert scenes[0].characters_present == ["char_001", "char_003"]
        assert scenes[0].elements[0].type == "dialogue"
        assert scenes[0].elements[0].speaker == "char_003"

    def test_name_whitespace_normalized(self):
        """角色名前后空白不影响匹配"""
        existing = [
            Character(id="char_001", name="陈平安", role="主角", description="..."),
        ]
        new_chars = [
            Character(id="char_001", name="  陈平安  ", role="主角", description="..."),
        ]
        merged, _ = merge_chapter_result(existing, new_chars, [])
        assert len(merged) == 1  # 视为同一角色





class TestAssembleScript:
    def test_assemble_basic(self):
        meta = Meta(title="测试剧本", original_work="原书", original_author="作者")
        all_chars = [
            Character(id="c1", name="甲", role="主角", description="..."),
            Character(id="c2", name="乙", role="配角", description="..."),
        ]
        scenes = [
            Scene(
                scene_number=1,
                location=Location(name="客厅", time="白天", description="阳光明媚"),
                characters_present=["c1", "c2"],
                elements=[ActionElement(type="action", content="甲乙相遇")],
            ),
        ]

        script = assemble_script(meta, all_chars, scenes)
        assert script.meta.title == "测试剧本"
        assert len(script.characters) == 2
        assert len(script.scenes) == 1
        assert script.scenes[0].scene_number == 1

    def test_re_number_scenes(self):
        """场景编号自动重排"""
        meta = Meta(title="T", original_work="W", original_author="A")
        scenes = [
            Scene(
                scene_number=99,
                location=Location(name="L", time="天", description=""),
                characters_present=[],
                elements=[],
            ),
            Scene(
                scene_number=42,
                location=Location(name="L", time="晚", description=""),
                characters_present=[],
                elements=[],
            ),
        ]
        script = assemble_script(meta, [], scenes)
        assert script.scenes[0].scene_number == 1
        assert script.scenes[1].scene_number == 2

    def test_deduplicate_characters(self):
        """重复角色自动去重"""
        meta = Meta(title="T", original_work="W", original_author="A")
        all_chars = [
            Character(id="c1", name="甲", role="主角", description="..."),
            Character(id="c1", name="甲", role="主角", description="..."),  # duplicate
            Character(id="c2", name="乙", role="配角", description="..."),
        ]
        script = assemble_script(meta, all_chars, [])
        assert len(script.characters) == 2

    def test_invalid_character_reference_raises(self):
        """场景引用了不存在的角色 ID 应抛出异常"""
        meta = Meta(title="T", original_work="W", original_author="A")
        scenes = [
            Scene(
                scene_number=1,
                location=Location(name="L", time="天", description=""),
                characters_present=["nonexistent_id"],
                elements=[],
            ),
        ]
        with pytest.raises(ValueError, match="不存在的角色 ID"):
            assemble_script(meta, [], scenes)


class TestToYaml:
    def test_to_yaml_output(self):
        script = Script(
            meta=Meta(title="测试", original_work="书", original_author="人"),
            characters=[
                Character(id="c1", name="张三", role="主角", description="一个人"),
            ],
            scenes=[
                Scene(
                    scene_number=1,
                    location=Location(name="家", time="夜", description="暗"),
                    characters_present=["c1"],
                    elements=[
                        ActionElement(type="action", content="张三开门"),
                    ],
                ),
            ],
        )
        yaml_str = to_yaml(script)
        assert "title: 测试" in yaml_str
        assert "characters:" in yaml_str
        assert "scenes:" in yaml_str
        assert "张三开门" in yaml_str

    def test_to_yaml_valid_yaml(self):
        """输出是合法的 YAML"""
        import yaml
        script = Script(
            meta=Meta(title="T", original_work="W", original_author="A"),
            characters=[],
            scenes=[],
        )
        yaml_str = to_yaml(script)
        parsed = yaml.safe_load(yaml_str)
        assert parsed is not None
        assert parsed["meta"]["title"] == "T"
