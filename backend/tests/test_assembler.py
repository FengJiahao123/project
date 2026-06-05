"""测试剧本组装器"""

import pytest
from novel_to_script.assembler import assemble_script, to_yaml
from novel_to_script.models import (
    Meta, Character, Scene, Location, ActionElement, Script
)


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
