"""FastAPI 路由 — /api/convert 和 /api/status"""

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
from novel_to_script.assembler import assemble_script, merge_chapter_result
from novel_to_script.config import DEEPSEEK_API_KEY

api_router = APIRouter(prefix="/api")

# 内存中的任务状态存储
tasks: dict[str, dict] = {}

# 根据是否有 API Key 选择 Provider
llm_provider = DeepSeekProvider() if DEEPSEEK_API_KEY else MockProvider()


async def _process_conversion(task_id: str, text: str):
    """后台异步处理转换任务，逐章更新进度。"""
    try:
        chapters = split_chapters(text)
        chapter_titles = [title for title, _ in chapters]
        tasks[task_id]["chapters"] = chapter_titles
        tasks[task_id]["status"] = "processing"
        tasks[task_id]["progress"] = 0

        all_chars = []
        all_scenes = []
        total = len(chapters)

        for i, (title, content) in enumerate(chapters):
            chars, scenes = await llm_provider.convert_chapter(title, content)
            all_chars, scenes = merge_chapter_result(all_chars, chars, scenes)
            all_scenes.extend(scenes)

            # 逐章更新进度
            progress = int(((i + 1) / total) * 90)  # 0-90% 为 LLM 处理阶段
            tasks[task_id]["progress"] = progress

        meta = Meta(
            title=f"《{chapter_titles[0] if chapter_titles else '未命名'}》剧本",
            original_work="原著小说",
            original_author="未知",
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
        tasks[task_id]["error"] = f"转换失败: {str(e)}"


@api_router.post("/convert", response_model=ConvertResponse)
async def start_conversion(request: ConvertRequest):
    """提交小说文本，立即返回任务 ID，后台逐章处理。"""
    chapters = split_chapters(request.text)

    if not chapters:
        raise HTTPException(status_code=400, detail="未能识别任何章节，请检查文本格式")

    task_id = str(uuid.uuid4())[:8]
    chapter_titles = [title for title, _ in chapters]

    tasks[task_id] = {
        "status": "processing",
        "progress": 0,
        "chapters": chapter_titles,
        "script": None,
        "error": None,
    }

    # 后台执行转换（不阻塞响应）
    asyncio.create_task(_process_conversion(task_id, request.text))

    return ConvertResponse(
        task_id=task_id,
        status="processing",
        progress=0,
        chapters=chapter_titles,
        script=None,
    )


@api_router.get("/convert/{task_id}", response_model=ConvertResponse)
async def get_status(task_id: str):
    """轮询转换任务的进度和结果。"""
    task = tasks.get(task_id)

    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")

    return ConvertResponse(
        task_id=task_id,
        status=task["status"],
        progress=task["progress"],
        chapters=task.get("chapters", []),
        script=task.get("script"),
        error=task.get("error"),
    )
