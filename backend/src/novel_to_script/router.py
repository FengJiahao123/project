"""FastAPI routes — /api/convert, /api/status, /api/outline, /api/revision"""

import asyncio
import json
import uuid
from fastapi import APIRouter, HTTPException
from novel_to_script.models import (
    ConvertRequest,
    ConvertResponse,
    Meta,
)
from novel_to_script.chapter_splitter import split_chapters
from novel_to_script.llm_provider import DeepSeekProvider, MockProvider
from novel_to_script.assembler import assemble_script
from novel_to_script.config import DEEPSEEK_API_KEY

api_router = APIRouter(prefix="/api")

tasks: dict[str, dict] = {}
llm_provider = DeepSeekProvider() if DEEPSEEK_API_KEY else MockProvider()


async def _process_conversion(task_id: str, text: str, outline: dict | None = None):
    """Background task: single LLM call for entire novel, then assemble."""
    try:
        chapters = split_chapters(text)
        chapter_titles = [title for title, _ in chapters]
        tasks[task_id]["chapters"] = chapter_titles
        tasks[task_id]["status"] = "processing"
        tasks[task_id]["progress"] = 5

        all_chars, all_scenes = await llm_provider.convert_novel(chapters, outline)

        meta = Meta(
            title=f"{chapter_titles[0] if chapter_titles else 'Untitled'} Script",
            original_work="Original Novel",
            original_author="Unknown",
        )

        script = assemble_script(meta, all_chars, all_scenes)
        tasks[task_id]["script"] = script
        tasks[task_id]["status"] = "completed"
        tasks[task_id]["progress"] = 100

    except ValueError as e:
        tasks[task_id]["status"] = "error"
        tasks[task_id]["error"] = str(e)
    except Exception as e:
        tasks[task_id]["status"] = "error"
        tasks[task_id]["error"] = f"Conversion failed: {str(e)}"


@api_router.post("/convert", response_model=ConvertResponse)
async def start_conversion(request: ConvertRequest):
    """Submit novel text, return task_id immediately, process in background."""
    chapters = split_chapters(request.text)

    if not chapters:
        raise HTTPException(status_code=400, detail="No chapters detected. Check text format.")

    task_id = str(uuid.uuid4())[:8]
    chapter_titles = [title for title, _ in chapters]

    tasks[task_id] = {
        "status": "processing",
        "progress": 5,
        "chapters": chapter_titles,
        "script": None,
        "error": None,
    }

    asyncio.create_task(_process_conversion(task_id, request.text, request.outline))

    return ConvertResponse(
        task_id=task_id,
        status="processing",
        progress=5,
        chapters=chapter_titles,
        script=None,
    )


@api_router.get("/convert/{task_id}", response_model=ConvertResponse)
async def get_status(task_id: str):
    """Poll task progress."""
    task = tasks.get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return ConvertResponse(
        task_id=task_id,
        status=task["status"],
        progress=task["progress"],
        chapters=task.get("chapters", []),
        script=task.get("script"),
        error=task.get("error"),
    )


# ====== Outline Analysis ======

OUTLINE_PROMPT = """You are a professional script analyst. Read the entire novel and produce a scene breakdown outline.

## Output Format

Return a JSON object (no markdown code blocks):

{
  "chapter_outlines": [
    {
      "chapter_title": "Chapter title",
      "scenes": [
        {
          "scene_number": 1,
          "location_name": "Location name",
          "time": "morning/day/night/evening",
          "summary": "What happens in this scene (2-3 sentences)",
          "key_dialogue_preview": "Short preview of key dialogue if any",
          "characters_involved": ["Character Name"]
        }
      ]
    }
  ],
  "character_preview": [
    {
      "name": "Character name",
      "role_guess": "protagonist/supporting/extra",
      "brief_intro": "One-line description",
      "first_appearance_scene": 1
    }
  ],
  "total_scenes": 9,
  "analysis_notes": "Brief notes about the novel structure and adaptation suggestions"
}

## Rules

1. Read ALL chapters before producing the outline
2. Each scene should be a self-contained unit with clear beginning/end
3. Character names must be from the actual novel text
4. scene_number sequential across all chapters
5. Return ONLY valid JSON, no extra text. DO NOT wrap in ```json markdown code blocks. Start your response with { and end with }."""



@api_router.post("/outline")
async def analyze_outline(request: dict):
    """Quick structural analysis — returns scene breakdown + character preview."""
    text = request.get("text", "")
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    chapters = split_chapters(text)
    if not chapters:
        raise HTTPException(status_code=400, detail="No chapters detected")

    try:
        client = llm_provider._client
        model = llm_provider._model

        # For large novels, send first N chapters + last 3 for overview
        MAX_OUTLINE_CHAPTERS = 20
        if len(chapters) > MAX_OUTLINE_CHAPTERS:
            outline_chapters = chapters[:MAX_OUTLINE_CHAPTERS - 3] + chapters[-3:]
        else:
            outline_chapters = chapters

        parts = []
        for title, content in outline_chapters:
            truncated = content[:1500] + ("..." if len(content) > 1500 else "")
            parts.append(f"## {title}\n\n{truncated}")
        full_text = "\n\n---\n\n".join(parts)

        resp = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": OUTLINE_PROMPT},
                {"role": "user", "content": f"Analyze this novel ({len(chapters)} chapters total, showing first {MAX_OUTLINE_CHAPTERS-3} + last 3) and produce a scene breakdown outline:\n\n{full_text}"},
            ],
            temperature=0.5,
            max_tokens=8192,
        )
        content = resp.choices[0].message.content or ""

        from novel_to_script.llm_provider import _extract_json
        data = _extract_json(content)

        return {
            "chapter_outlines": data.get("chapter_outlines", []),
            "character_preview": data.get("character_preview", []),
            "total_scenes": data.get("total_scenes", 0),
            "analysis_notes": data.get("analysis_notes", ""),
            "chapter_titles": [title for title, _ in chapters],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Outline analysis failed: {str(e)}")


# ====== AI Revision ======

REVISION_PROMPT = """You are a professional script editor. Given a complete script in JSON format and a user's revision instruction, modify the script accordingly.

## Rules

1. ONLY modify parts related to the user's instruction. Keep everything else identical.
2. Return the ENTIRE modified script as valid JSON — not just the changed parts.
3. You may add/remove/modify scenes, characters, dialogue, actions, or any element.
4. If adding new characters, assign them new IDs (char_NNN format, next available number).
5. If the instruction changes a character's personality, update their traits[] and adjust their dialogue emotion/notes accordingly.
6. Provide a brief summary of what you changed in Chinese.

## Output Format

Return a JSON object (no markdown code blocks):

{
  "modified_script": { ... full script JSON ... },
  "message": "Summary of changes in Chinese",
  "changes_summary": ["Change 1", "Change 2"]
}"""


@api_router.post("/revision")
async def revise_script(request: dict):
    """Accept a script JSON + user instruction, return AI-modified script."""
    script_json = request.get("script")
    instruction = request.get("instruction", "")

    if not script_json or not instruction.strip():
        raise HTTPException(status_code=400, detail="script and instruction are required")

    try:
        client = llm_provider._client
        model = llm_provider._model

        payload = json.dumps(script_json, ensure_ascii=False, indent=2)
        user_message = f"## Original Script\n\n```json\n{payload}\n```\n\n## Revision Instruction\n\n{instruction}"

        resp = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": REVISION_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.5,
            max_tokens=16384,
        )
        content = resp.choices[0].message.content or ""

        from novel_to_script.llm_provider import _extract_json
        data = _extract_json(content)

        return {
            "modified_script": data.get("modified_script", script_json),
            "message": data.get("message", ""),
            "changes_summary": data.get("changes_summary", []),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI revision failed: {str(e)}")
