"""AI 小说转剧本工具 — FastAPI 入口"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="AI 小说转剧本工具",
    description="将小说文本自动转换为结构化 YAML 剧本",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from novel_to_script.router import api_router
app.include_router(api_router)


@app.get("/api/health")
async def health_check():
    """健康检查接口"""
    return {"status": "ok", "version": "0.1.0"}
