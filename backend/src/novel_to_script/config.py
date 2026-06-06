"""应用配置"""

DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEEPSEEK_MODEL = "deepseek-chat"

# API Key 由用户通过前端设置，不在代码中硬编码
DEEPSEEK_API_KEY = ""

# 内存中的 API Key（用户设置后覆盖）
_user_api_key: str | None = None


def get_api_key() -> str | None:
    """获取用户设置的 API Key。"""
    return _user_api_key


def set_api_key(key: str) -> None:
    """设置用户的 API Key。"""
    global _user_api_key
    _user_api_key = key


def has_api_key() -> bool:
    """检查用户是否已设置 API Key。"""
    return bool(_user_api_key)
