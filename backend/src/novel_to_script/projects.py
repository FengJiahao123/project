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
