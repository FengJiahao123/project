"""测试 FastAPI 路由"""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from novel_to_script.main import app


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


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
        """提交含3章的文本应返回 completed 状态和剧本"""
        text = "第1章 测试\n这是测试内容。\n第2章 继续\n更多内容。\n第3章 结尾\n结束。"

        response = await client.post(
            "/api/convert",
            json={"text": text},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["progress"] == 100
        assert len(data["chapters"]) == 3
        assert data["script"] is not None
        assert "meta" in data["script"]
        assert "characters" in data["script"]
        assert "scenes" in data["script"]

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
        """无章节标记的文本返回 '全文' 并成功处理"""
        text = "这是一段没有任何章节标记的文本。"
        response = await client.post(
            "/api/convert",
            json={"text": text},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert len(data["chapters"]) == 1
        assert data["chapters"][0] == "全文"


class TestStatus:
    @pytest.mark.asyncio
    async def test_get_status_not_found(self, client):
        """不存在的任务应返回 404"""
        response = await client.get("/api/convert/nonexistent")
        assert response.status_code == 404
