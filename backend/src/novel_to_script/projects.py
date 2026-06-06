"""项目管理 — 创建、列表、加载、删除"""

import json
from novel_to_script.database import get_db


async def create_project(user_id: int, name: str, original_text: str = "") -> dict:
    """创建新项目"""
    db = await get_db()
    try:
        cursor = await db.execute(
            "INSERT INTO projects (user_id, name, original_text) VALUES (?, ?, ?)",
            (user_id, name, original_text),
        )
        await db.commit()
        return {"ok": True, "project_id": cursor.lastrowid}
    finally:
        await db.close()


async def list_projects(user_id: int) -> list[dict]:
    """列出用户的所有项目"""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, name, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC",
            (user_id,),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


async def get_project(user_id: int, project_id: int) -> dict | None:
    """获取单个项目的完整数据"""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM projects WHERE id = ? AND user_id = ?",
            (project_id, user_id),
        )
        row = await cursor.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


async def save_project(
    user_id: int, project_id: int, original_text: str = "", script_json: str = ""
) -> bool:
    """保存项目数据"""
    db = await get_db()
    try:
        await db.execute(
            "UPDATE projects SET original_text = ?, script_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
            (original_text, script_json, project_id, user_id),
        )
        await db.commit()
        return True
    finally:
        await db.close()


async def delete_project(user_id: int, project_id: int) -> bool:
    """删除项目"""
    db = await get_db()
    try:
        cursor = await db.execute(
            "DELETE FROM projects WHERE id = ? AND user_id = ?",
            (project_id, user_id),
        )
        await db.commit()
        return cursor.rowcount > 0
    finally:
        await db.close()


# ====== Revision History ======

async def add_revision(
    project_id: int, action: str, script_json: str = "",
    chapter_count: int = 0, scene_count: int = 0, chapter_names: str = "",
    revision_id: int = 0,
) -> dict:
    """记录一次生成/修改。revision_id > 0 时更新已有记录而非新增。"""
    db = await get_db()
    try:
        if revision_id > 0:
            # 更新已有记录
            await db.execute(
                "UPDATE revisions SET script_json = ?, scene_count = ?, chapter_count = ?, chapter_names = ?, action = ? WHERE id = ? AND project_id = ?",
                (script_json, scene_count, chapter_count, chapter_names, action, revision_id, project_id),
            )
            await db.execute(
                "UPDATE projects SET script_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (script_json, project_id),
            )
            await db.commit()
            return {"ok": True, "revision_id": revision_id, "summary": ""}
        else:
            # 新增记录
            cur = await db.execute(
                "SELECT COALESCE(MAX(version), 0) + 1 as v FROM revisions WHERE project_id = ?",
                (project_id,),
            )
            row = await cur.fetchone()
            version = row["v"]

            summary = chapter_names if chapter_names else f"第{version}版"

            cur2 = await db.execute(
                "INSERT INTO revisions (project_id, version, action, summary, script_json, chapter_count, scene_count, chapter_names) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (project_id, version, action, summary, script_json, chapter_count, scene_count, chapter_names),
            )
            await db.execute(
                "UPDATE projects SET script_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (script_json, project_id),
            )
            await db.commit()
            return {"ok": True, "revision_id": cur2.lastrowid, "summary": summary}
        return {"ok": True, "version": version, "summary": summary}
    finally:
        await db.close()


async def list_revisions(project_id: int) -> list[dict]:
    """列出项目的所有历史版本"""
    db = await get_db()
    try:
        cur = await db.execute(
            "SELECT id, version, action, summary, chapter_count, scene_count, created_at FROM revisions WHERE project_id = ? ORDER BY version DESC",
            (project_id,),
        )
        rows = await cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


async def get_revision(revision_id: int) -> dict | None:
    """获取某个版本的具体 script_json"""
    db = await get_db()
    try:
        cur = await db.execute(
            "SELECT * FROM revisions WHERE id = ?", (revision_id,),
        )
        row = await cur.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()
