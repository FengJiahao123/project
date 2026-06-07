"""FastAPI routes — user-isolated LLM, projects, auth"""

import asyncio
import json
import uuid
from fastapi import APIRouter, HTTPException, Request
from novel_to_script.models import ConvertRequest, ConvertResponse, Meta
from novel_to_script.chapter_splitter import split_chapters
from novel_to_script.llm_provider import DeepSeekProvider, MockProvider
from novel_to_script.assembler import assemble_script
from novel_to_script import config as api_config
from novel_to_script.auth import register_user, login_user, verify_token, get_user_profile, update_profile, change_password
from novel_to_script.projects import (create_project, list_projects, get_project, save_project, delete_project, add_revision, list_revisions, get_revision)

api_router = APIRouter(prefix="/api")
tasks: dict[str, dict] = {}
_user_providers: dict[int, DeepSeekProvider] = {}


async def _get_provider(user_id: int):
    """Get or create user's LLM provider."""
    if user_id not in _user_providers:
        key = await api_config.get_api_key(user_id)
        if key:
            _user_providers[user_id] = DeepSeekProvider(key)
    if user_id not in _user_providers:
        return MockProvider()
    return _user_providers[user_id]


def _get_user_id(req: Request) -> int:
    auth = req.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="需要登录")
    payload = verify_token(auth[7:])
    if not payload:
        raise HTTPException(status_code=401, detail="登录已过期")
    return payload["user_id"]


# ====== Config ======

@api_router.get("/config")
async def api_get_config(req: Request):
    try:
        uid = _get_user_id(req)
        ok = await api_config.has_api_key(uid)
        return {"api_key_set": ok}
    except HTTPException:
        return {"api_key_set": False}


@api_router.post("/config/key")
async def api_set_key(request: dict, req: Request):
    uid = _get_user_id(req)
    key = request.get("api_key", "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="API Key 不能为空")
    await api_config.set_api_key(uid, key)
    _user_providers[uid] = DeepSeekProvider(key)
    return {"ok": True, "message": "API Key 已设置"}


# ====== Convert ======

async def _process_conversion(task_id: str, user_id: int, text: str,
                               outline: dict | None = None, chapter_indices: list[int] | None = None):
    try:
        all_chapters = split_chapters(text)
        if chapter_indices is not None and len(chapter_indices) > 0:
            valid = sorted(i for i in chapter_indices if 0 <= i < len(all_chapters))
            chapters = [all_chapters[i] for i in valid]
        else:
            chapters = all_chapters
        tasks[task_id]["chapters"] = [t for t, _ in chapters]
        tasks[task_id]["status"] = "processing"
        tasks[task_id]["progress"] = 5

        provider = await _get_provider(user_id)
        all_chars, all_scenes = await provider.convert_novel(chapters, outline)

        meta = Meta(title=f"{chapters[0][0] if chapters else 'Untitled'} Script",
                    original_work="Original Novel", original_author="Unknown")
        script = assemble_script(meta, all_chars, all_scenes)
        tasks[task_id]["script"] = script
        tasks[task_id]["status"] = "completed"
        tasks[task_id]["progress"] = 100
    except ValueError as e:
        tasks[task_id]["status"] = "error"; tasks[task_id]["error"] = str(e)
    except Exception as e:
        tasks[task_id]["status"] = "error"; tasks[task_id]["error"] = f"Conversion failed: {str(e)}"


@api_router.post("/convert", response_model=ConvertResponse)
async def start_conversion(request: ConvertRequest, req: Request):
    uid = _get_user_id(req)
    if not await api_config.has_api_key(uid):
        raise HTTPException(status_code=400, detail="请先设置 API Key")
    chapters = split_chapters(request.text)
    if not chapters:
        raise HTTPException(status_code=400, detail="No chapters detected")
    task_id = str(uuid.uuid4())[:8]
    tasks[task_id] = {"status": "processing", "progress": 5, "chapters": [t for t, _ in chapters], "script": None, "error": None}
    asyncio.create_task(_process_conversion(task_id, uid, request.text, request.outline, request.chapter_indices))
    return ConvertResponse(task_id=task_id, status="processing", progress=5, chapters=[t for t, _ in chapters], script=None)


@api_router.get("/convert/{task_id}", response_model=ConvertResponse)
async def get_status(task_id: str):
    task = tasks.get(task_id)
    if not task: raise HTTPException(status_code=404, detail="Task not found")
    return ConvertResponse(task_id=task_id, status=task["status"], progress=task["progress"], chapters=task.get("chapters", []), script=task.get("script"), error=task.get("error"))


# ====== Chapters / Outline ======

@api_router.post("/chapters")
async def detect_chapters(request: dict):
    text = request.get("text", "")
    if not text.strip(): raise HTTPException(status_code=400, detail="Text is required")
    chapters = split_chapters(text)
    return {"chapters": [{"index": i, "title": t, "length": len(c)} for i, (t, c) in enumerate(chapters)], "total_chapters": len(chapters), "total_chars": sum(len(c) for _, c in chapters)}


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
5. Return ONLY valid JSON, no extra text. Start your response with { and end with }."""


@api_router.post("/outline")
async def analyze_outline(request: dict, req: Request):
    uid = _get_user_id(req)
    if not await api_config.has_api_key(uid):
        raise HTTPException(status_code=400, detail="请先设置 API Key")
    text = request.get("text", ""); chapters = split_chapters(text)
    if not text.strip(): raise HTTPException(status_code=400, detail="Text is required")
    if not chapters: raise HTTPException(status_code=400, detail="No chapters detected")
    try:
        provider = await _get_provider(uid)
        MAX_OUTLINE = 20
        outline_chapters = chapters[:MAX_OUTLINE - 3] + chapters[-3:] if len(chapters) > MAX_OUTLINE else chapters
        parts = [f"## {t}\n\n{c[:1500]}{'...' if len(c) > 1500 else ''}" for t, c in outline_chapters]
        resp = await provider._client.chat.completions.create(
            model=provider._model,
            messages=[{"role": "system", "content": OUTLINE_PROMPT}, {"role": "user", "content": f"Analyze:\n\n{"\n".join(parts)}"}],
            temperature=0.5, max_tokens=8192,
        )
        from novel_to_script.llm_provider import _extract_json; data = _extract_json(resp.choices[0].message.content or "")
        return {"chapter_outlines": data.get("chapter_outlines", []), "character_preview": data.get("character_preview", []), "total_scenes": data.get("total_scenes", 0), "analysis_notes": data.get("analysis_notes", ""), "chapter_titles": [t for t, _ in chapters]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Outline failed: {str(e)}")


# ====== Revision ======

REVISION_PROMPT = """You are a professional script editor. Given a complete script in JSON format and a user's revision instruction, modify the script accordingly.

## Rules

1. ONLY modify parts related to the user's instruction. Keep everything else identical.
2. Return the ENTIRE modified script as valid JSON — not just the changed parts.
3. You may add/remove/modify scenes, characters, dialogue, actions, or any element.
4. If adding new characters, assign them new IDs (char_NNN format, next available number).
5. Provide a brief summary of what you changed in Chinese.

## Output Format

Return a JSON object (no markdown code blocks):

{
  "modified_script": { ... full script JSON ... },
  "message": "Summary of changes in Chinese",
  "changes_summary": ["Change 1", "Change 2"]
}"""


@api_router.post("/revision")
async def revise_script(request: dict, req: Request):
    uid = _get_user_id(req)
    if not await api_config.has_api_key(uid):
        raise HTTPException(status_code=400, detail="请先设置 API Key")
    script_json = request.get("script"); instruction = request.get("instruction", "")
    if not script_json or not instruction.strip():
        raise HTTPException(status_code=400, detail="script and instruction are required")
    try:
        provider = await _get_provider(uid)
        payload = json.dumps(script_json, ensure_ascii=False, indent=2)
        resp = await provider._client.chat.completions.create(
            model=provider._model,
            messages=[{"role": "system", "content": REVISION_PROMPT}, {"role": "user", "content": f"## Original\n```json\n{payload}\n```\n\n## Instruction\n\n{instruction}"}],
            temperature=0.5, max_tokens=16384,
        )
        from novel_to_script.llm_provider import _extract_json; data = _extract_json(resp.choices[0].message.content or "")
        return {"modified_script": data.get("modified_script", script_json), "message": data.get("message", ""), "changes_summary": data.get("changes_summary", [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Revision failed: {str(e)}")


# ====== Auth ======

@api_router.post("/auth/register")
async def api_register(request: dict):
    result = await register_user(request.get("username", ""), request.get("password", ""))
    if not result["ok"]: raise HTTPException(status_code=400, detail=result["message"])
    return result

@api_router.post("/auth/login")
async def api_login(request: dict):
    result = await login_user(request.get("username", ""), request.get("password", ""))
    if not result["ok"]: raise HTTPException(status_code=400, detail=result["message"])
    return result

@api_router.get("/auth/me")
async def api_me(req: Request): return await get_user_profile(_get_user_id(req))

@api_router.post("/auth/profile")
async def api_update_profile(request: dict, req: Request): return await update_profile(_get_user_id(req), request.get("display_name", ""))

@api_router.post("/auth/password")
async def api_change_password(request: dict, req: Request):
    result = await change_password(_get_user_id(req), request.get("old_password", ""), request.get("new_password", ""))
    if not result["ok"]: raise HTTPException(status_code=400, detail=result.get("message", "修改失败"))
    return result


# ====== Projects ======

@api_router.post("/projects")
async def api_create_project(request: dict, req: Request): return await create_project(_get_user_id(req), request.get("name", "未命名"), request.get("text", ""))

@api_router.get("/projects")
async def api_list_projects(req: Request): return await list_projects(_get_user_id(req))

@api_router.get("/projects/{project_id}")
async def api_get_project(project_id: int, req: Request):
    proj = await get_project(_get_user_id(req), project_id)
    if not proj: raise HTTPException(status_code=404, detail="项目不存在")
    return proj

@api_router.put("/projects/{project_id}")
async def api_save_project(project_id: int, request: dict, req: Request): return {"ok": await save_project(_get_user_id(req), project_id, request.get("text", ""), request.get("script_json", ""))}

@api_router.delete("/projects/{project_id}")
async def api_delete_project(project_id: int, req: Request):
    if not await delete_project(_get_user_id(req), project_id): raise HTTPException(status_code=404, detail="项目不存在")
    return {"ok": True}


# ====== Revisions ======

@api_router.post("/projects/{project_id}/revisions")
async def api_add_revision(project_id: int, request: dict, req: Request): return await add_revision(project_id, request.get("action", "生成"), request.get("script_json", ""), request.get("chapter_count", 0), request.get("scene_count", 0), request.get("chapter_names", ""), request.get("revision_id", 0))

@api_router.get("/projects/{project_id}/revisions")
async def api_list_revisions(project_id: int, req: Request): return await list_revisions(project_id)

@api_router.get("/projects/{project_id}/revisions/{revision_id}")
async def api_get_revision(project_id: int, revision_id: int, req: Request):
    r = await get_revision(revision_id)
    if not r: raise HTTPException(status_code=404, detail="版本不存在")
    return r
