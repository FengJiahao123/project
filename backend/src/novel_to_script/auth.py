"""用户认证模块"""

import hashlib
import secrets
import jwt
import time
from novel_to_script.database import get_db

JWT_SECRET = secrets.token_hex(32)
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
    except Exception:
        return {"ok": False, "message": "用户名已存在"}
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
