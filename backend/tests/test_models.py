"""测试 Pydantic 数据模型"""

import pytest
from pydantic import ValidationError
from novel_to_script.models import (
    Meta,
    Relationship,
    Character,
    Location,
    ActionElement,
    DialogueElement,
    TransitionElement,
    Scene,
    Script,
    ConvertRequest,
    ConvertResponse,
)


class TestMeta:
    def test_valid_meta(self):
        m = Meta(title="测试", original_work="原书", original_author="作者")
        assert m.title == "测试"
        assert m.adapter == ""
        assert m.version == "1.0"

    def test_defaults(self):
        m = Meta(title="T", original_work="W", original_author="A")
        assert m.adapter == ""
        assert m.version == "1.0"


class TestCharacter:
    def test_valid_character(self):
        c = Character(id="c1", name="张三", role="主角", description="一个冒险者")
        assert c.id == "c1"
        assert c.traits == []
        assert c.relationships == []

    def test_with_relationship(self):
        c = Character(
            id="c1",
            name="张三",
            role="主角",
            description="...",
            relationships=[Relationship(target="c2", relation="朋友")],
        )
        assert len(c.relationships) == 1
        assert c.relationships[0].target == "c2"


class TestScene:
    def test_valid_scene(self):
        scene = Scene(
            scene_number=1,
            location=Location(name="客厅", time="白天", description="温馨"),
            characters_present=["c1"],
            elements=[
                ActionElement(type="action", content="开门"),
                DialogueElement(
                    type="dialogue",
                    speaker="c1",
                    lines=["你好"],
                    emotion="开心",
                ),
                TransitionElement(type="transition", content="渐黑"),
            ],
        )
        assert scene.scene_number == 1
        assert len(scene.elements) == 3
        assert scene.elements[1].type == "dialogue"


class TestScript:
    def test_complete_script(self):
        script = Script(
            meta=Meta(title="剧", original_work="书", original_author="人"),
            characters=[
                Character(id="c1", name="甲", role="主角", description="..."),
            ],
            scenes=[
                Scene(
                    scene_number=1,
                    location=Location(name="点", time="昼", description="..."),
                    characters_present=["c1"],
                    elements=[
                        ActionElement(type="action", content="走来"),
                    ],
                ),
            ],
        )
        assert len(script.characters) == 1
        assert len(script.scenes) == 1


class TestConvertRequest:
    def test_valid_request(self):
        req = ConvertRequest(text="第一章  初遇\n\n张三走进房间。")
        assert req.text == "第一章  初遇\n\n张三走进房间。"

    def test_empty_text_fails(self):
        with pytest.raises(ValidationError):
            ConvertRequest(text="")


class TestConvertResponse:
    def test_response_with_script(self):
        resp = ConvertResponse(
            status="completed",
            progress=100,
            script=Script(
                meta=Meta(title="T", original_work="W", original_author="A"),
                characters=[],
                scenes=[],
            ),
        )
        assert resp.status == "completed"
        assert resp.progress == 100
        assert resp.script is not None
