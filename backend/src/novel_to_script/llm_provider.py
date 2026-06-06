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

FULL_NOVEL_PROMPT = """You are a professional script adaptation assistant. Convert the following novel into a structured screenplay in YAML-compatible JSON format.

## Output Format

Return a JSON object (no markdown code blocks):

{
  "characters": [
    {
      "id": "char_001",
      "name": "Character name",
      "role": "protagonist/supporting/extra",
      "description": "Background description",
      "traits": ["trait1", "trait2"]
    }
  ],
  "scenes": [
    {
      "scene_number": 1,
      "location": {
        "name": "Location name",
        "time": "morning/day/night/evening",
        "description": "Setting description"
      },
      "characters_present": ["char_001"],
      "elements": [
        {"type": "action", "content": "Stage direction or action description"},
        {"type": "dialogue", "speaker": "char_001", "lines": ["Line 1", "Line 2"], "emotion": "tone", "notes": "performance note"},
        {"type": "transition", "content": "Transition description"}
      ]
    }
  ]
}

## Rules

1. Read ALL chapters carefully first. Understand the full story, all characters, and all relationships.
2. Character IDs: char_001, char_002... in order of first appearance across the ENTIRE novel
3. role must be one of: "protagonist", "supporting", "extra"
4. elements order by time sequence: mix action, dialogue, transition
5. dialogue speaker must reference a defined character id
6. characters_present lists ALL characters in the scene (including silent ones)
7. Extract REAL character names and dialogue from the text. Do NOT invent.
8. Return ONLY the JSON object, no extra text."""


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

    def __init__(self):
        self._client = AsyncOpenAI(
            api_key=DEEPSEEK_API_KEY,
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
            max_tokens=8192,
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
        BATCH_SIZE = 8
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
            max_tokens=16384,
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
