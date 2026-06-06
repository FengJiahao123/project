"""测试 FastAPI 路由"""

import asyncio
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from novel_to_script.main import app
from novel_to_script.llm_provider import MockProvider


@pytest_asyncio.fixture
async def client():
    """使用 MockProvider 的测试客户端，避免调用真实 API"""
    import novel_to_script.router as router_module
    original = router_module.llm_provider
    router_module.llm_provider = MockProvider()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac
    finally:
        router_module.llm_provider = original


async def poll_until_done(client, task_id: str, timeout: float = 5.0):
    """轮询任务状态直到完成或超时。"""
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        resp = await client.get(f"/api/convert/{task_id}")
        data = resp.json()
        if data["status"] in ("completed", "error"):
            return data
        await asyncio.sleep(0.05)
    raise TimeoutError(f"任务 {task_id} 在 {timeout}s 内未完成")


class TestHealthCheck:
    @pytest.mark.asyncio
    async def test_health(self, client):
        response = await client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"


class TestConvert:
    @pytest.mark.asyncio
    async def test_convert_with_chapters(self, client):
        """提交含3章文本 → 立即返回 processing → 轮询后完成"""
        text = "第1章 测试\n这是测试内容。\n第2章 继续\n更多内容。\n第3章 结尾\n结束。"

        response = await client.post(
            "/api/convert",
            json={"text": text},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "processing"
        assert data["task_id"] is not None
        assert len(data["chapters"]) == 3

        # 轮询等待后台处理完成
        completed = await poll_until_done(client, data["task_id"])
        assert completed["status"] == "completed"
        assert completed["progress"] == 100
        assert completed["script"] is not None
        assert "meta" in completed["script"]
        assert "characters" in completed["script"]
        assert "scenes" in completed["script"]

    @pytest.mark.asyncio
    async def test_convert_empty_text(self, client):
        """空文本应返回 422"""
        response = await client.post(
            "/api/convert",
            json={"text": ""},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_convert_no_chapters(self, client):
        """无章节标记的文本 → 返回 '全文' 并完成"""
        text = "这是一段没有任何章节标记的文本。"
        response = await client.post(
            "/api/convert",
            json={"text": text},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "processing"
        assert data["task_id"] is not None
        assert len(data["chapters"]) == 1
        assert data["chapters"][0] == "全文"

        completed = await poll_until_done(client, data["task_id"])
        assert completed["status"] == "completed"


class TestStatus:
    @pytest.mark.asyncio
    async def test_get_status_not_found(self, client):
        """不存在的任务应返回 404"""
        response = await client.get("/api/convert/nonexistent")
        assert response.status_code == 404
