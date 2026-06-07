"""应用配置"""

DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEEPSEEK_MODEL = "deepseek-chat"
DEEPSEEK_API_KEY = ""  # Legacy — now per-user in DB

# 每个用户的 API Key 存储在数据库中


async def _ensure_column():
    """确保 users 表有 api_key 列（兼容旧数据库）"""
    from novel_to_script.database import get_db
    db = await get_db()
    try:
        await db.execute("ALTER TABLE users ADD COLUMN api_key TEXT DEFAULT ''")
        await db.commit()
    except Exception:
        pass  # column already exists
    finally:
        await db.close()


async def get_api_key(user_id: int) -> str | None:
    """获取指定用户的 API Key。"""
    from novel_to_script.database import get_db
    db = await get_db()
    try:
        cur = await db.execute("SELECT api_key FROM users WHERE id = ?", (user_id,))
        row = await cur.fetchone()
        return row["api_key"] if row and row["api_key"] else None
    finally:
        await db.close()


async def set_api_key(user_id: int, key: str) -> None:
    """设置指定用户的 API Key。"""
    await _ensure_column()
    from novel_to_script.database import get_db
    db = await get_db()
    try:
        await db.execute("UPDATE users SET api_key = ? WHERE id = ?", (key, user_id))
        await db.commit()
    finally:
        await db.close()


async def has_api_key(user_id: int) -> bool:
    """检查指定用户是否已设置 API Key。"""
    from novel_to_script.database import get_db
    await _ensure_column()
    db = await get_db()
    try:
        cur = await db.execute("SELECT api_key FROM users WHERE id = ?", (user_id,))
        row = await cur.fetchone()
        return bool(row and row["api_key"])
    finally:
        await db.close()
