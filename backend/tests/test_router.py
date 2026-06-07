"""测试 FastAPI 路由"""

import asyncio
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from novel_to_script.main import app
from novel_to_script.llm_provider import MockProvider


@pytest_asyncio.fixture
async def client():
    """Override user provider with MockProvider for tests"""
    import novel_to_script.router as router_module

    mock = MockProvider()
    original_get_provider = router_module._get_provider
    async def _mock_get_provider(uid): return mock
    router_module._get_provider = _mock_get_provider

    # Ensure test user has API key set
    import novel_to_script.config as config_module
    await config_module.set_api_key(1, "test-key")

    # Patch verify_token in router module (not auth module — router imported it already)
    original_verify = router_module.verify_token
    router_module.verify_token = lambda t: ({"user_id": 1, "username": "test"} if t == "fake-token" else None)

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test",
            headers={"Authorization": "Bearer fake-token"}
        ) as ac:
            yield ac
    finally:
        router_module._get_provider = original_get_provider
        router_module.verify_token = original_verify


async def poll_until_done(client, task_id: str, timeout: float = 5.0):
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        resp = await client.get(f"/api/convert/{task_id}")
        data = resp.json()
        if data["status"] in ("completed", "error"):
            return data
        await asyncio.sleep(0.05)
    raise TimeoutError(f"Task {task_id} not done in {timeout}s")


class TestHealthCheck:
    @pytest.mark.asyncio
    async def test_health(self, client):
        r = await client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


class TestConvert:
    @pytest.mark.asyncio
    async def test_convert_with_chapters(self, client):
        pad = "X" * 120
        text = f"第1章 测试\n{pad}\n第2章 继续\n{pad}\n第3章 结尾\n{pad}"
        r = await client.post("/api/convert", json={"text": text})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "processing"
        assert d["task_id"] is not None
        assert len(d["chapters"]) == 3
        c = await poll_until_done(client, d["task_id"])
        assert c["status"] == "completed"
        assert c["progress"] == 100
        assert c["script"] is not None
        assert "meta" in c["script"]
        assert "characters" in c["script"]
        assert "scenes" in c["script"]

    @pytest.mark.asyncio
    async def test_convert_empty_text(self, client):
        r = await client.post("/api/convert", json={"text": ""})
        assert r.status_code == 422

    @pytest.mark.asyncio
    async def test_convert_no_chapters(self, client):
        text = "这是一段没有任何章节标记的文本。"
        r = await client.post("/api/convert", json={"text": text})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "processing"
        assert d["task_id"] is not None
        assert d["chapters"] == ["全文"]
        c = await poll_until_done(client, d["task_id"])
        assert c["status"] == "completed"


class TestStatus:
    @pytest.mark.asyncio
    async def test_get_status_not_found(self, client):
        r = await client.get("/api/convert/nonexistent")
        assert r.status_code == 404
