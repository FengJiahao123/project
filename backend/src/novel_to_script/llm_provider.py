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

FULL_NOVEL_PROMPT = """你是一个专业的剧本转写专家。你的任务是将小说的**每一个情节**都转换为剧本格式，决不遗漏。

## 输出格式

返回 JSON（不要 markdown 包裹）：
{
  "characters": [{"id": "char_001", "name": "角色名", "role": "主角/配角/龙套", "description": "角色背景", "traits": ["性格标签"]}],
  "scenes": [{
    "scene_number": 1,
    "location": {"name": "地点", "time": "清晨/上午/下午/傍晚/夜晚", "description": "环境细节"},
    "characters_present": ["char_001"],
    "elements": [元素列表]
  }]
}

元素类型：
- {"type": "action", "content": "动作描述"}
- {"type": "dialogue", "speaker": "char_001", "lines": ["台词1", "台词2"], "emotion": "语气", "notes": "提示"}
- {"type": "transition", "content": "转场"}

## 最重要的规则：不要遗漏任何情节

**每一段对话 = 一个场景**。**每一次人物行动 = 一个场景**。**每一次地点转移 = 一个场景**。

判断是否该有单独场景的标准：
- 两个人说了话 → 必须有 dialogue element
- 主角做了某个动作（买东西、走路遇见人、干活）→ 必须有 action element
- 环境或时间变了 → 新场景
- 出现了原文中没有的新人物 → 必须加入 characters 列表

**对于重要情节**（推动故事、展示人物关系）：4-6 个 elements，包含完整对话和情感标注。
**对于过渡性情节**（走路、干活、日常）：1-2 个 action element 概括即可，但不能省略。

## 示例：一章应该拆成多少场景

一章 3000 字的小说，通常包含 4-7 个场景。例如：
- 主角起床、回忆往事 → 场景1
- 邻居来访、告知消息 → 场景2
- 主角去镇上、路遇某人 → 场景3
- 买卖交易、被他人抢先 → 场景4（绝不能漏！）
- 回家路上、遇到算命先生 → 场景5
- 回到家、与邻居对话 → 场景6

**检查方法**：生成后数一下，一章 3000 字至少产出 4 个场景。如果只有 2 个场景，肯定漏了。

## 回忆/闪回的处理（非常重要）

**小说中的回忆、闪回、内心独白，绝不能压缩成一句话**。要作为独立场景完整展开。

错误示例：
  原文："陈平安想起白天买鲤鱼被抢的经过"
  错误转写：{"type": "action", "content": "陈平安想起白天买鱼被抢。"}  ← 太简略！

正确做法：把回忆内容写成独立场景，就像它正在发生一样。
  场景A（当前时间线）：锦衣少年道谢、丢绣袋
  场景B（闪回）：陈平安在街上看到中年人提鱼篓 → 出价十文被拒 → 软磨硬泡谈到二十文 → 锦衣少年出现用五十文直接买走 → 陈平安无奈看他们离开

**回忆场景中的人物也要加入 characters 列表**（如卖鱼中年人），即使只在这一场出现。

## 对话处理

- 原文中有对话的地方，必须转为 dialogue element。不要把对话改写成 action 描述。
- 对话的 lines 数组每项是一句台词，不要合并多句。
- emotion 和 notes 尽量填写，帮助演员理解表演方式。

## 其他规则

1. 角色 ID char_001, char_002... 按首次出场顺序
2. role 必须是：主角/配角/龙套
3. speaker 引用 characters 中已定义的 id
4. 真实角色名、真实对话，不编造
5. 先通读全文再开始写
6. 只返回 JSON，不返回其他文字"""


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
    """Build Character from LLM dict with role mapping, null-safe."""
    return Character(
        id=data.get("id") or "",
        name=data.get("name") or "",
        role=_map_role(data.get("role") or ""),
        description=data.get("description") or "",
        traits=(data.get("traits") or []),
        relationships=(data.get("relationships") or []),
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
    """Convert LLM dict to Scene, with null-safe defaults."""
    elements = []
    for el in (data.get("elements") or []):
        t = (el.get("type") or "action")
        if t == "action":
            elements.append(ActionElement(type="action", content=el.get("content") or ""))
        elif t == "dialogue":
            speaker = el.get("speaker") or ""
            lines = el.get("lines") or []
            elements.append(DialogueElement(
                type="dialogue", speaker=speaker,
                lines=lines if isinstance(lines, list) else [str(lines)],
                emotion=el.get("emotion") or "",
                notes=el.get("notes") or "",
            ))
        elif t == "transition":
            elements.append(TransitionElement(type="transition", content=el.get("content") or ""))
    return Scene(
        scene_number=data.get("scene_number", scene_number),
        location=Location(
            name=(data.get("location") or {}).get("name") or "",
            time=(data.get("location") or {}).get("time") or "",
            description=(data.get("location") or {}).get("description") or "",
        ),
        characters_present=data.get("characters_present") or [],
        elements=elements,
    )
