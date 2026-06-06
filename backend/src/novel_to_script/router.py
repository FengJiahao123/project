"""FastAPI routes — /api/convert and /api/status"""

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


async def _process_conversion(task_id: str, text: str):
    """Background task: single LLM call for entire novel, then assemble."""
    try:
        chapters = split_chapters(text)
        chapter_titles = [title for title, _ in chapters]
        tasks[task_id]["chapters"] = chapter_titles

        # Single call — LLM sees all chapters at once
        tasks[task_id]["status"] = "processing"
        tasks[task_id]["progress"] = 5

        all_chars, all_scenes = await llm_provider.convert_novel(chapters)

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

    asyncio.create_task(_process_conversion(task_id, request.text))

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
  "message": "修改说明 in Chinese",
  "changes_summary": ["变更1", "变更2"]
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
            "message": data.get("message", "修改完成"),
            "changes_summary": data.get("changes_summary", []),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI revision failed: {str(e)}")
