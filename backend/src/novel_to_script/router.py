"""FastAPI 路由 — /api/convert 和 /api/status"""

import uuid
from fastapi import APIRouter, HTTPException
from novel_to_script.models import (
    ConvertRequest,
    ConvertResponse,
    Meta,
)
from novel_to_script.chapter_splitter import split_chapters
from novel_to_script.llm_provider import MockProvider
from novel_to_script.assembler import assemble_script

api_router = APIRouter(prefix="/api")

# 内存中的任务状态存储（生产环境应使用 Redis 等）
tasks: dict[str, dict] = {}

# 默认 LLM Provider（后续可替换为真实 API）
llm_provider = MockProvider()


@api_router.post("/convert", response_model=ConvertResponse)
async def start_conversion(request: ConvertRequest):
    """提交小说文本，开始转换。

    当前 MVP 版本为同步处理（使用 MockProvider），后续异步版本可用 GET /api/convert/{task_id} 轮询。
    """
    # 先分章节
    chapters = split_chapters(request.text)

    if not chapters:
        raise HTTPException(status_code=400, detail="未能识别任何章节，请检查文本格式")

    chapter_titles = [title for title, _ in chapters]

    try:
        all_chars = []
        all_scenes = []

        for i, (title, content) in enumerate(chapters):
            chars, scenes = await llm_provider.convert_chapter(title, content)
            all_chars.extend(chars)
            all_scenes.extend(scenes)

        meta = Meta(
            title=f"《{chapter_titles[0] if chapter_titles else '未命名'}》剧本",
            original_work="原著小说",
            original_author="未知",
        )

        script = assemble_script(meta, all_chars, all_scenes)
        return ConvertResponse(
            status="completed",
            progress=100,
            chapters=chapter_titles,
            script=script,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"转换失败: {str(e)}")


@api_router.get("/convert/{task_id}", response_model=ConvertResponse)
async def get_status(task_id: str):
    """查询转换任务的进度和结果（为后续异步版本预留）。"""
    task = tasks.get(task_id)

    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")

    return ConvertResponse(
        status=task["status"],
        progress=task["progress"],
        chapters=task["chapters"],
        script=task["script"],
        error=task["error"],
    )
