"""FastAPI routes — /api/convert, /api/status, /api/outline, /api/revision, /api/auth, /api/projects"""

import asyncio
import json
import uuid
from fastapi import APIRouter, HTTPException, Request
from novel_to_script.models import (
    ConvertRequest,
    ConvertResponse,
    Meta,
)
from novel_to_script.chapter_splitter import split_chapters
from novel_to_script.llm_provider import DeepSeekProvider, MockProvider
from novel_to_script.assembler import assemble_script
from novel_to_script.config import has_api_key, set_api_key, get_api_key
from novel_to_script.auth import register_user, login_user, verify_token
from novel_to_script.projects import (
    create_project, list_projects, get_project, save_project, delete_project,
)

api_router = APIRouter(prefix="/api")

tasks: dict[str, dict] = {}
llm_provider = MockProvider()  # 默认使用 Mock，用户设置 Key 后切换


def _ensure_provider():
    """如果用户设置了 Key 且当前是 Mock，切换到真实 Provider。"""
    global llm_provider
    if has_api_key() and isinstance(llm_provider, MockProvider):
        llm_provider = DeepSeekProvider(get_api_key())


@api_router.get("/config")
async def get_config():
    """返回当前配置状态。"""
    return {"api_key_set": has_api_key()}


@api_router.post("/config/key")
async def update_api_key(request: dict):
    """设置用户的 API Key。"""
    key = request.get("api_key", "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="API Key 不能为空")
    set_api_key(key)
    global llm_provider
    llm_provider = DeepSeekProvider(key)
    return {"ok": True, "message": "API Key 已设置"}


async def _process_conversion(
    task_id: str, text: str, outline: dict | None = None, chapter_indices: list[int] | None = None
):
    """Background task: LLM calls for novel chapters, then assemble."""
    try:
        all_chapters = split_chapters(text)

        # Filter to selected chapters if indices provided
        if chapter_indices is not None and len(chapter_indices) > 0:
            valid = sorted(i for i in chapter_indices if 0 <= i < len(all_chapters))
            chapters = [all_chapters[i] for i in valid]
        else:
            chapters = all_chapters
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
    if isinstance(llm_provider, MockProvider) and not has_api_key():
        raise HTTPException(status_code=400, detail="请先在页面顶部设置 API Key")
    _ensure_provider()
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

    asyncio.create_task(_process_conversion(task_id, request.text, request.outline, request.chapter_indices))

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



@api_router.post("/chapters")
async def detect_chapters(request: dict):
    """Detect chapters in novel text, return list with char counts."""
    text = request.get("text", "")
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text is required")
    chapters = split_chapters(text)
    return {
        "chapters": [
            {"index": i, "title": t, "length": len(c)}
            for i, (t, c) in enumerate(chapters)
        ],
        "total_chapters": len(chapters),
        "total_chars": sum(len(c) for _, c in chapters),
    }


@api_router.post("/outline")
async def analyze_outline(request: dict):
    """Quick structural analysis — returns scene breakdown + character preview."""
    text = request.get("text", "")
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text is required")
    if isinstance(llm_provider, MockProvider) and not has_api_key():
        raise HTTPException(status_code=400, detail="请先在页面顶部设置 API Key")

    chapters = split_chapters(text)
    if not chapters:
        raise HTTPException(status_code=400, detail="No chapters detected")

    try:
        _ensure_provider()
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
    if isinstance(llm_provider, MockProvider) and not has_api_key():
        raise HTTPException(status_code=400, detail="请先在页面顶部设置 API Key")
    _ensure_provider()
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


# ====== Auth ======

def _get_user_id(request: Request) -> int:
    """从 Authorization header 提取 user_id"""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="需要登录")
    payload = verify_token(auth[7:])
    if not payload:
        raise HTTPException(status_code=401, detail="登录已过期")
    return payload["user_id"]


@api_router.post("/auth/register")
async def api_register(request: dict):
    """注册"""
    result = await register_user(request.get("username", ""), request.get("password", ""))
    if not result["ok"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@api_router.post("/auth/login")
async def api_login(request: dict):
    """登录"""
    result = await login_user(request.get("username", ""), request.get("password", ""))
    if not result["ok"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@api_router.get("/auth/me")
async def api_me(req: Request):
    """获取当前用户信息"""
    uid = _get_user_id(req)
    payload = verify_token(req.headers["Authorization"][7:])
    return {"user_id": uid, "username": payload["username"]}


# ====== Projects ======

@api_router.post("/projects")
async def api_create_project(request: dict, req: Request):
    """创建项目"""
    uid = _get_user_id(req)
    name = request.get("name", "未命名项目")
    text = request.get("text", "")
    result = await create_project(uid, name, text)
    return result


@api_router.get("/projects")
async def api_list_projects(req: Request):
    """列出项目"""
    uid = _get_user_id(req)
    return await list_projects(uid)


@api_router.get("/projects/{project_id}")
async def api_get_project(project_id: int, req: Request):
    """获取项目"""
    uid = _get_user_id(req)
    proj = await get_project(uid, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="项目不存在")
    return proj


@api_router.put("/projects/{project_id}")
async def api_save_project(project_id: int, request: dict, req: Request):
    """保存项目"""
    uid = _get_user_id(req)
    text = request.get("text", "")
    script_json = request.get("script_json", "")
    await save_project(uid, project_id, text, script_json)
    return {"ok": True}


@api_router.delete("/projects/{project_id}")
async def api_delete_project(project_id: int, req: Request):
    """删除项目"""
    uid = _get_user_id(req)
    ok = await delete_project(uid, project_id)
    if not ok:
        raise HTTPException(status_code=404, detail="项目不存在")
    return {"ok": True}
