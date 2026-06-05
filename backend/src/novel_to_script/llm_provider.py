"""LLM Provider 抽象接口 + Mock 实现 + DeepSeek 实现

通过 Protocol 定义接口，业务代码只依赖此接口，不依赖具体 SDK。
更换 LLM API 时只需新增一个实现类。
"""

import json
import re
from typing import Protocol, runtime_checkable
from openai import AsyncOpenAI
from novel_to_script.models import (
    Script, Meta, Character, Scene, Location,
    ActionElement, DialogueElement, TransitionElement,
)
from novel_to_script.config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL

SCHEMA_PROMPT = """你是一个专业的剧本改编助手。请将以下小说章节转换为结构化的剧本片段。

## 输出格式

请严格返回 JSON 对象（不要包含 markdown 代码块标记），格式如下：

```json
{
  "characters": [
    {
      "id": "char_001",
      "name": "角色名",
      "role": "主角",
      "description": "身份背景描述",
      "traits": ["性格标签"]
    }
  ],
  "scenes": [
    {
      "scene_number": 1,
      "location": {
        "name": "场景地点",
        "time": "白天/夜晚/清晨/傍晚",
        "description": "环境描写"
      },
      "characters_present": ["char_001"],
      "elements": [
        {"type": "action", "content": "动作或舞台指示描述"},
        {"type": "dialogue", "speaker": "char_001", "lines": ["台词行1", "台词行2"], "emotion": "语气（可选）", "notes": "表演备注（可选）"},
        {"type": "transition", "content": "转场描述"}
      ]
    }
  ]
}
```

## 重要规则

1. 角色 id 格式为 char_001, char_002... 按出场顺序编号
2. role 必须是 "主角"、"配角"、"龙套" 之一
3. elements 按时间顺序混合排列 action、dialogue、transition
4. dialogue 的 speaker 必须引用 characters 中已定义的 id
5. characters_present 列出本场景所有在场角色（包括无台词者）
6. 仔细分析原文，提取真实角色名和对话内容，不要编造
7. 只返回 JSON，不要有任何额外文字"""


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


class DeepSeekProvider:
    """DeepSeek LLM Provider — 使用 DeepSeek API 进行小说→剧本转换"""

    def __init__(self):
        self._client = AsyncOpenAI(
            api_key=DEEPSEEK_API_KEY,
            base_url=DEEPSEEK_BASE_URL,
        )
        self._model = DEEPSEEK_MODEL

    async def convert_chapter(
        self, chapter_title: str, chapter_text: str
    ) -> tuple[list[Character], list[Scene]]:
        """调用 DeepSeek API 将章节转换为剧本片段"""

        user_message = f"## 章节标题\n{chapter_title}\n\n## 章节内容\n{chapter_text}"

        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": SCHEMA_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.7,
            max_tokens=8192,
        )

        content = response.choices[0].message.content or ""

        # 解析 JSON
        data = _extract_json(content)

        # 转换为 Pydantic 模型
        characters = [Character(**c) for c in data.get("characters", [])]
        scenes = [_parse_scene(s) for s in data.get("scenes", [])]

        return characters, scenes


def _extract_json(text: str) -> dict:
    """从 LLM 响应中提取 JSON 对象。

    处理可能包裹在 markdown 代码块中的 JSON。
    """
    # 尝试直接解析
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 尝试提取 markdown 代码块中的 JSON
    json_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass

    # 尝试找到第一个 { 到最后一个 } 的范围
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError(f"无法从 LLM 响应中解析 JSON: {text[:200]}...")


def _parse_scene(data: dict) -> Scene:
    """将 LLM 返回的字典转换为 Scene 对象"""
    elements = []
    for el in data.get("elements", []):
        el_type = el.get("type", "")
        if el_type == "action":
            elements.append(ActionElement(type="action", content=el.get("content", "")))
        elif el_type == "dialogue":
            elements.append(DialogueElement(
                type="dialogue",
                speaker=el.get("speaker", ""),
                lines=el.get("lines", []),
                emotion=el.get("emotion", ""),
                notes=el.get("notes", ""),
            ))
        elif el_type == "transition":
            elements.append(TransitionElement(type="transition", content=el.get("content", "")))

    return Scene(
        scene_number=data.get("scene_number", 1),
        location=Location(
            name=data.get("location", {}).get("name", ""),
            time=data.get("location", {}).get("time", ""),
            description=data.get("location", {}).get("description", ""),
        ),
        characters_present=data.get("characters_present", []),
        elements=elements,
    )
