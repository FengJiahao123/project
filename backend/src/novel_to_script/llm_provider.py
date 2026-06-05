"""LLM Provider 抽象接口 + Mock 实现

通过 Protocol 定义接口，业务代码只依赖此接口，不依赖具体 SDK。
更换 LLM API 时只需新增一个实现类。
"""

from typing import Protocol, runtime_checkable
from novel_to_script.models import Script, Meta, Character, Scene, Location, ActionElement


SCHEMA_PROMPT = """
你是一个专业的剧本改编助手。请将以下小说章节转换为结构化的剧本片段。

## 输出要求

请返回一个 JSON 对象，包含以下字段：
- characters: 本章出现的角色列表，每个角色包含 id, name, role（主角/配角/龙套）, description, traits
- scenes: 本章的场景列表，每个场景包含 scene_number, location(name/time/description), characters_present（角色 ID 列表）, elements（按时间顺序的场景元素）
- elements 中的每项：type 为 action/dialogue/transition 之一

## 重要：dialogue 元素必须放在独立的 action/transition 之前
请按时间顺序排列 elements。dialogue 元素的 speaker 必须引用 characters 中的 id。
"""


@runtime_checkable
class LLMProvider(Protocol):
    """LLM Provider 协议接口"""

    async def convert_chapter(
        self, chapter_title: str, chapter_text: str
    ) -> tuple[list[Character], list[Scene]]:
        """将单个章节转换为角色列表和场景列表。

        Args:
            chapter_title: 章节标题
            chapter_text: 章节文本内容

        Returns:
            (新增角色列表, 场景列表)
        """
        ...


class MockProvider:
    """Mock LLM Provider — 返回模拟数据，用于前后端联调和测试"""

    async def convert_chapter(
        self, chapter_title: str, chapter_text: str
    ) -> tuple[list[Character], list[Scene]]:
        """生成模拟剧本数据"""

        # 提取章节中出现的"角色数"（简单的启发式）
        char_count = max(1, len(chapter_text) // 500)

        characters: list[Character] = []
        for i in range(char_count):
            characters.append(
                Character(
                    id=f"char_{i+1:03d}",
                    name=f"角色{i+1}",
                    role="主角" if i == 0 else "配角",
                    description=f"{chapter_title}中出现的角色",
                    traits=["机智"] if i == 0 else [],
                )
            )

        # 生成模拟场景
        scene = Scene(
            scene_number=1,
            location=Location(
                name="示例场景",
                time="白天",
                description="一个通用的场景地点",
            ),
            characters_present=[c.id for c in characters],
            elements=[
                ActionElement(
                    type="action",
                    content="（这是模拟数据。接入真实 LLM API 后将生成实际剧本内容）",
                ),
                ActionElement(
                    type="action",
                    content=f"场景发生在{chapter_title}所描述的环境中。",
                ),
            ],
        )

        return characters, [scene]
