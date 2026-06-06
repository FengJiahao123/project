"""LLM Provider abstract interface + Mock + DeepSeek implementation"""

import json
import re
from typing import Protocol, runtime_checkable
from openai import AsyncOpenAI
from novel_to_script.models import (
    Script, Meta, Character, Scene, Location,
    ActionElement, DialogueElement, TransitionElement,
)
from novel_to_script.config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL
from novel_to_script.assembler import merge_chapter_result

FULL_NOVEL_PROMPT = """你是一个专业的影视剧本改编专家。请将以下小说完整改编为结构化的剧本。

## 输出格式

返回 JSON 对象（不要用 markdown 代码块包裹）：

{
  "characters": [
    {
      "id": "char_001",
      "name": "角色名",
      "role": "主角/配角/龙套",
      "description": "角色背景描述",
      "traits": ["性格标签"]
    }
  ],
  "scenes": [
    {
      "scene_number": 1,
      "location": {
        "name": "场景地点",
        "time": "清晨/白天/下午/傍晚/夜晚",
        "description": "环境细节描写"
      },
      "characters_present": ["char_001"],
      "elements": [
        {"type": "action", "content": "详细的动作或舞台指示"},
        {"type": "dialogue", "speaker": "char_001", "lines": ["台词第一句", "台词第二句"], "emotion": "语气情绪", "notes": "表演提示"},
        {"type": "transition", "content": "转场方式"}
      ]
    }
  ]
}

## 核心规则（非常重要）

1. **先通读全部章节**，理解完整故事脉络、所有角色和他们的关系
2. **不要概括或省略**。每个关键情节都要成为独立的场景。一场对话 = 一个场景，一次重要事件 = 一个场景
3. **每个场景至少 2 个 elements**，包含原文中的真实对话和动作描述
4. **角色 ID 按出场顺序编号**：char_001, char_002... 全局唯一
5. role 选其一：主角 / 配角 / 龙套
6. elements 按剧情时间顺序混合排列 action、dialogue、transition
7. dialogue 的 speaker 必须引用 characters 中已定义的 id
8. characters_present 列出本场景所有在场角色（包括没台词但有动作的）
9. **提取原文中真实的角色名和对话**，不要自己编造
10. 只返回 JSON，不要任何额外文字"""


@runtime_checkable
class LLMProvider(Protocol):
    """LLM Provider protocol interface"""

    async def convert_chapter(
        self, chapter_title: str, chapter_text: str
    ) -> tuple[list[Character], list[Scene]]:
        """Convert a single chapter to character and scene lists."""
        ...

    async def convert_novel(
        self, chapters: list[tuple[str, str]], outline: dict | None = None
    ) -> tuple[list[Character], list[Scene]]:
        """Convert ALL chapters at once to complete character and scene lists.

        Args:
            chapters: List of (chapter_title, chapter_text) tuples
            outline: Optional user-edited outline for guidance

        Returns:
            (complete character list, complete scene list)
        """
        ...


class MockProvider:
    """Mock LLM Provider for testing without real API"""

    async def convert_chapter(
        self, chapter_title: str, chapter_text: str
    ) -> tuple[list[Character], list[Scene]]:
        """Generate mock script data for one chapter"""
        char_count = max(1, len(chapter_text) // 500)
        characters: list[Character] = []
        for i in range(char_count):
            characters.append(Character(
                id=f"char_{i+1:03d}",
                name=f"Character {i+1}",
                role="主角" if i == 0 else "配角",
                description=f"Character from {chapter_title}",
                traits=["clever"] if i == 0 else [],
            ))
        scene = Scene(
            scene_number=1,
            location=Location(name="Example", time="day", description="Generic location"),
            characters_present=[c.id for c in characters],
            elements=[
                ActionElement(type="action", content="(Mock data. Real API will generate actual script content.)"),
            ],
        )
        return characters, [scene]

    async def convert_novel(
        self, chapters: list[tuple[str, str]], outline: dict | None = None
    ) -> tuple[list[Character], list[Scene]]:
        """Generate mock script data for all chapters at once"""
        chars: list[Character] = []
        scenes: list[Scene] = []
        for i, (title, content) in enumerate(chapters):
            c, s = await self.convert_chapter(title, content)
            for sc in s:
                sc.scene_number = len(scenes) + 1
            chars.extend(c)
            scenes.extend(s)
        return chars, scenes


class DeepSeekProvider:
    """DeepSeek LLM Provider for novel-to-script conversion"""

    def __init__(self, api_key: str = ""):
        key = api_key or DEEPSEEK_API_KEY
        self._client = AsyncOpenAI(
            api_key=key,
            base_url=DEEPSEEK_BASE_URL,
        )
        self._model = DEEPSEEK_MODEL

    async def convert_chapter(
        self, chapter_title: str, chapter_text: str
    ) -> tuple[list[Character], list[Scene]]:
        """Convert a single chapter (legacy method, prefer convert_novel)"""
        user_message = f"## Chapter Title\n{chapter_title}\n\n## Chapter Content\n{chapter_text}"
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": FULL_NOVEL_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.7,
            max_tokens=16384,
        )
        content = response.choices[0].message.content or ""
        data = _extract_json(content)
        characters = [_build_character(c) for c in data.get("characters", [])]
        scenes = [_parse_scene(s, i + 1) for i, s in enumerate(data.get("scenes", []))]
        return characters, scenes

    async def convert_novel(
        self, chapters: list[tuple[str, str]], outline: dict | None = None
    ) -> tuple[list[Character], list[Scene]]:
        """Convert entire novel — batch chapters if needed."""
        BATCH_SIZE = 4
        if len(chapters) <= BATCH_SIZE:
            return await self._convert_batch(chapters, outline, None)

        # Batch processing: send batches of chapters, accumulate characters
        all_chars: list[Character] = []
        all_scenes: list[Scene] = []
        existing_characters: list[dict] = []
        scene_offset = 0

        for batch_start in range(0, len(chapters), BATCH_SIZE):
            batch = chapters[batch_start:batch_start + BATCH_SIZE]
            chars, scenes = await self._convert_batch(
                batch, outline, existing_characters if existing_characters else None
            )
            # Merge characters by name
            merged_chars, scenes = merge_chapter_result(
                all_chars, chars, scenes
            )
            all_chars = merged_chars
            all_scenes.extend(scenes)

        return all_chars, all_scenes

    async def _convert_batch(
        self,
        chapters: list[tuple[str, str]],
        outline: dict | None,
        existing_characters: list[dict] | None,
    ) -> tuple[list[Character], list[Scene]]:
        """Convert a batch of chapters."""
        parts = []
        if existing_characters:
            parts.append("## Previously Identified Characters (keep their IDs)\n")
            parts.append(json.dumps(existing_characters, ensure_ascii=False, indent=2))
            parts.append("\n---\n")

        for title, content in chapters:
            parts.append(f"## {title}\n\n{content}")
        full_text = "\n\n---\n\n".join(parts)

        outline_guide = ""
        if outline:
            outline_guide = "\n\n## Scene Outline (FOLLOW THIS STRUCTURE)\n\n"
            outline_guide += json.dumps(outline, ensure_ascii=False, indent=2)
            outline_guide += "\n\nFollow this scene breakdown."

        user_msg = full_text + outline_guide

        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": FULL_NOVEL_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.7,
            max_tokens=32768,
        )
        content = response.choices[0].message.content or ""
        data = _extract_json(content)
        characters = [_build_character(c) for c in data.get("characters", [])]
        scenes = [_parse_scene(s, i + 1) for i, s in enumerate(data.get("scenes", []))]
        return characters, scenes


def _build_character(data: dict) -> Character:
    """Build Character from LLM dict with role mapping."""
    return Character(
        id=data.get("id", ""),
        name=data.get("name", ""),
        role=_map_role(data.get("role", "")),
        description=data.get("description", ""),
        traits=data.get("traits", []),
        relationships=data.get("relationships", []),
    )


def _extract_json(text: str) -> dict:
    """Extract JSON object from LLM response, handling markdown code blocks."""
    t = text.strip()

    # 1: direct parse
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        pass

    # 2: ```json ... ``` or ``` ... ```
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", t)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass

    # 3: strip opening ```json or ```, try remainder
    stripped = re.sub(r"^```(?:json)?\s*", "", t)
    stripped = re.sub(r"\s*```\s*$", "", stripped)
    if stripped != t:
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            pass

    # 4: extract from first { to last }
    start = t.find("{")
    end = t.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(t[start:end + 1])
        except json.JSONDecodeError:
            pass

    # 5: try stripping leading backticks from trimmed text too
    if start == -1 and stripped != t:
        start = stripped.find("{")
        end = stripped.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(stripped[start:end + 1])
            except json.JSONDecodeError:
                pass

    raise ValueError(f"Cannot parse JSON from LLM response: {text[:300]}...")


def _map_role(role: str) -> str:
    """Map English/Chinese role values to Schema values."""
    m = {
        "protagonist": "主角", "supporting": "配角", "extra": "龙套",
        "主角": "主角", "配角": "配角", "龙套": "龙套",
    }
    return m.get(role.lower() if role else "", "配角")


def _parse_scene(data: dict, scene_number: int) -> Scene:
    """Convert LLM dict to Scene, with explicit scene_number override."""
    elements = []
    for el in data.get("elements", []):
        t = el.get("type", "")
        if t == "action":
            elements.append(ActionElement(type="action", content=el.get("content", "")))
        elif t == "dialogue":
            elements.append(DialogueElement(
                type="dialogue", speaker=el.get("speaker", ""),
                lines=el.get("lines", []),
                emotion=el.get("emotion", ""),
                notes=el.get("notes", ""),
            ))
        elif t == "transition":
            elements.append(TransitionElement(type="transition", content=el.get("content", "")))
    return Scene(
        scene_number=data.get("scene_number", scene_number),
        location=Location(
            name=data.get("location", {}).get("name", ""),
            time=data.get("location", {}).get("time", ""),
            description=data.get("location", {}).get("description", ""),
        ),
        characters_present=data.get("characters_present", []),
        elements=elements,
    )
