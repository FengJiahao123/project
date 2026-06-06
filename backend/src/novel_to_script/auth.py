"""用户认证模块"""

import hashlib
import os
import secrets
import jwt
import time
from novel_to_script.database import get_db

# 持久化 JWT 密钥，服务重启后 token 依然有效
_SECRET_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "data", ".jwt_secret")
os.makedirs(os.path.dirname(_SECRET_FILE), exist_ok=True)
if os.path.exists(_SECRET_FILE):
    JWT_SECRET = open(_SECRET_FILE).read().strip()
else:
    JWT_SECRET = secrets.token_hex(32)
    with open(_SECRET_FILE, "w") as f:
        f.write(JWT_SECRET)

JWT_EXPIRY = 7 * 24 * 3600  # 7 days


def hash_password(password: str) -> str:
    """SHA256 哈希密码"""
    return hashlib.sha256(password.encode()).hexdigest()


def create_token(user_id: int, username: str) -> str:
    """生成 JWT token"""
    return jwt.encode(
        {"user_id": user_id, "username": username, "exp": int(time.time()) + JWT_EXPIRY},
        JWT_SECRET,
        algorithm="HS256",
    )


def verify_token(token: str) -> dict | None:
    """验证 JWT token，返回 payload 或 None"""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


async def register_user(username: str, password: str) -> dict:
    """注册新用户。返回 {ok, message, token?}"""
    if not username.strip() or len(username.strip()) < 2:
        return {"ok": False, "message": "用户名至少 2 个字符"}
    if len(password) < 4:
        return {"ok": False, "message": "密码至少 4 位"}

    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username.strip(), hash_password(password)),
        )
        await db.commit()
        user = await db.execute(
            "SELECT id FROM users WHERE username = ?", (username.strip(),)
        )
        row = await user.fetchone()
        token = create_token(row["id"], username.strip())
        return {"ok": True, "message": "注册成功", "token": token, "username": username.strip()}
    except Exception as e:
        msg = str(e)
        if "UNIQUE" in msg.upper():
            return {"ok": False, "message": "用户名已存在"}
        return {"ok": False, "message": f"注册失败：{msg[:50]}"}
    finally:
        await db.close()


async def login_user(username: str, password: str) -> dict:
    """用户登录。返回 {ok, message, token?}"""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?",
            (username.strip(),),
        )
        row = await cursor.fetchone()
        if not row or row["password_hash"] != hash_password(password):
            return {"ok": False, "message": "用户名或密码错误"}
        token = create_token(row["id"], row["username"])
        return {"ok": True, "message": "登录成功", "token": token, "username": row["username"]}
    finally:
        await db.close()


async def get_user_profile(user_id: int) -> dict:
    """获取用户信息 + 统计数据"""
    db = await get_db()
    try:
        cur = await db.execute("SELECT username, display_name, created_at FROM users WHERE id = ?", (user_id,))
        user = await cur.fetchone()
        if not user:
            return {"ok": False}
        cur2 = await db.execute("SELECT COUNT(*) as c FROM projects WHERE user_id = ?", (user_id,))
        project_count = (await cur2.fetchone())["c"]
        cur3 = await db.execute(
            "SELECT COUNT(*) as c FROM revisions r INNER JOIN projects p ON r.project_id = p.id WHERE p.user_id = ?",
            (user_id,),
        )
        revision_count = (await cur3.fetchone())["c"]
        return {
            "ok": True,
            "username": user["username"],
            "display_name": user["display_name"] or user["username"],
            "created_at": user["created_at"],
            "project_count": project_count,
            "revision_count": revision_count,
        }
    finally:
        await db.close()


async def update_profile(user_id: int, display_name: str = "") -> dict:
    """更新用户资料"""
    db = await get_db()
    try:
        await db.execute("UPDATE users SET display_name = ? WHERE id = ?", (display_name.strip(), user_id))
        await db.commit()
        return {"ok": True}
    finally:
        await db.close()


async def change_password(user_id: int, old_password: str, new_password: str) -> dict:
    """修改密码"""
    if len(new_password) < 4:
        return {"ok": False, "message": "新密码至少 4 位"}
    db = await get_db()
    try:
        cur = await db.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,))
        row = await cur.fetchone()
        if not row or row["password_hash"] != hash_password(old_password):
            return {"ok": False, "message": "原密码错误"}
        await db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(new_password), user_id))
        await db.commit()
        return {"ok": True, "message": "密码已修改"}
    finally:
        await db.close()
