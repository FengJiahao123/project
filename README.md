# AI 小说转剧本工具

将小说文本自动转换为结构化 YAML 剧本格式，帮助作者快速获得可编辑、可进一步打磨的剧本初稿。

## 功能

- 支持多种章节格式（第1章 / 第一章 / Chapter 1）
- AI 驱动的章节分析和剧本生成
- 输出标准 YAML 格式的结构化剧本
- 自动提取角色并建立角色关系
- 场景统计与角色概览
- 一键下载 YAML 剧本文件

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript 6 + Vite + Tailwind CSS 4 |
| 后端 | Python 3.12 + FastAPI + Pydantic |
| AI   | 抽象 LLM Provider 接口（可接入任意 LLM API）|
| 数据 | YAML（剧本 Schema）、JSON（API 通信）|

## 快速开始

### 环境要求

- Python 3.12+
- Node.js 18+
- uv（Python 包管理工具）

### 安装与运行

```bash
# 1. 克隆仓库
git clone https://github.com/FengJiahao123/project.git
cd project

# 2. 启动后端
cd backend
uv sync
uv run uvicorn novel_to_script.main:app --reload --port 8000

# 3. 启动前端（新终端）
cd frontend
npm install
npm run dev
```

4. 浏览器打开 `http://localhost:5173`

## 剧本 YAML Schema

详见 `docs/schema-design.md`，包含完整的 Schema 定义和设计原则说明。

### 快速示例

```yaml
meta:
  title: "剧本标题"
  original_work: "原著小说名"
  original_author: "原著作者"

characters:
  - id: "char_001"
    name: "角色名"
    role: "主角"
    description: "身份背景描述"
    traits: ["机智", "勇敢"]

scenes:
  - scene_number: 1
    location:
      name: "场景地点"
      time: "白天"
      description: "环境描述"
    characters_present: ["char_001"]
    elements:
      - type: "action"
        content: "角色推开门走进房间"
      - type: "dialogue"
        speaker: "char_001"
        lines:
          - "你终于来了。"
        emotion: "低沉"
      - type: "transition"
        content: "淡出至黑场"
```

## 项目结构

```
├── backend/                     # Python FastAPI 后端
│   ├── pyproject.toml
│   └── src/novel_to_script/
│       ├── main.py              # FastAPI 入口
│       ├── models.py            # Pydantic 数据模型
│       ├── router.py            # API 路由
│       ├── chapter_splitter.py  # 章节分块
│       ├── llm_provider.py      # LLM Provider 接口
│       └── assembler.py         # 剧本组装 + YAML 序列化
├── frontend/                    # React 前端
│   └── src/
│       ├── App.tsx              # 主应用
│       ├── types.ts             # TypeScript 类型
│       ├── api.ts               # API 客户端
│       └── components/          # UI 组件
└── docs/
    ├── schema-design.md         # YAML Schema 设计文档
    └── superpowers/             # 设计文档与实现计划
```

## 依赖说明

### 后端

| 包 | 用途 |
|----|------|
| fastapi | Web 框架 |
| uvicorn | ASGI 服务器 |
| pydantic | 数据校验与模型 |
| pyyaml | YAML 序列化 |
| pytest / httpx | 测试 |

### 前端

| 包 | 用途 |
|----|------|
| react / react-dom | UI 框架 |
| typescript | 类型系统 |
| vite | 构建工具 |
| tailwindcss | CSS 样式 |
| js-yaml | 前端 YAML 生成 |

## 开发过程

本项目采用持续交付方式开发，所有 PR 记录在 GitHub 仓库中。开发文档位于 `docs/superpowers/` 目录。
