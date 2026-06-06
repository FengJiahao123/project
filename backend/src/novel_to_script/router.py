"""FastAPI routes — /api/convert and /api/status"""

import asyncio
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
