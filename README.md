# 小说转剧本工坊

将小说文本自动转换为结构化剧本，支持 YAML / Fountain / 打印 PDF 多格式导出，帮助作者快速获得可编辑、可进一步打磨的剧本初稿。

## 功能特性

### 📖 小说导入
- 上传 .txt 文件或粘贴文本
- 自动识别章节（支持中文数字、阿拉伯数字、Chapter X 格式）
- 按章节选择转换范围，实时字数统计与阈值提醒

### 🤖 AI 剧本生成
- 全文批量分析：一次 API 调用处理全部选中章节
- 中文 prompt 优化：原文对话保留、回忆场景独立展开
- 多阶段进度条："理解全文 → 分析角色 → 编写剧本"

### 📜 多视图预览
- **剧本预览**：行业标准排版（Courier 字体、角色居中、对白缩窄）
- **场景卡片**：Trello 式卡片视图，支持拖拽重排场景顺序
- **角色关系图谱**：Canvas 力导向图，角色节点可拖拽
- **角色列表** + **统计数据**
- **YAML 源码**：符合 Schema 定义的结构化数据

### 🎬 剧本编辑
- **内联编辑**：点击剧本任意内容直接修改（标题、对话、动作等）
- **AI 协作修改**：自然语言指令侧边栏，AI 自动定位并修改
- 修改确认/撤销，YAML 和所有 Tab 实时同步

### 💾 格式导出
| 格式 | 用途 |
|------|------|
| YAML | 结构化数据，可编程处理 |
| Fountain | 行业标准，可导入 Final Draft / Fade In |
| 纯文本 | 复制粘贴，通用兼容 |
| 打印 PDF | 浏览器打印 → 另存为 PDF |

### 🔐 用户系统
- 注册 / 登录（JWT 认证）
- 项目管理（创建、打开、删除）
- 历史版本（每次生成自动记录，支持回溯查看）
- 个人中心（资料编辑、使用统计、修改密码）
- API Key 由用户自行设置，不写入代码仓库

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS 4 |
| 后端 | Python 3.12 + FastAPI + Pydantic + aiosqlite |
| AI 引擎 | 抽象 LLM Provider 接口（支持 DeepSeek / OpenAI 兼容 API）|
| 数据存储 | SQLite（用户 + 项目 + 历史版本）|
| 数据格式 | YAML（剧本 Schema）、JSON（API）、Fountain（导出）|

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
5. 注册账户 → 创建项目 → 上传小说 → 选择章节 → 开始转化

## 项目结构

```
├── backend/                     # Python FastAPI 后端
│   └── src/novel_to_script/
│       ├── main.py              # FastAPI 入口
│       ├── models.py            # Pydantic 数据模型
│       ├── router.py            # API 路由
│       ├── chapter_splitter.py  # 章节分块引擎
│       ├── llm_provider.py      # LLM Provider（协议 + DeepSeek）
│       ├── assembler.py         # 剧本组装 + YAML 序列化
│       ├── auth.py              # 用户认证（JWT）
│       ├── database.py          # SQLite 数据库
│       ├── projects.py          # 项目管理 + 版本历史
│       └── config.py            # 配置管理
├── frontend/                    # React 前端
│   └── src/
│       ├── App.tsx              # 主应用 + 路由
│       ├── types.ts             # TypeScript 类型
│       ├── api.ts               # API 客户端
│       ├── utils/fountain.ts    # Fountain 格式导出
│       └── components/          # UI 组件
└── docs/
    ├── schema-design.md         # YAML Schema 设计文档
    └── superpowers/             # 设计文档与实现计划
```

## 剧本 YAML Schema

详见 `docs/schema-design.md`。

```yaml
meta:
  title: "剧本标题"
  original_work: "原著小说"
  original_author: "作者"

characters:
  - id: "char_001"
    name: "陈平安"
    role: "主角"
    description: "泥瓶巷贫寒少年"
    traits: ["坚韧", "善良"]
    relationships:
      - target: "char_002"
        relation: "朋友"

scenes:
  - scene_number: 1
    location:
      name: "泥瓶巷"
      time: "清晨"
      description: "老旧巷弄"
    characters_present: ["char_001", "char_002"]
    elements:
      - type: "action"
        content: "陈平安起床煮粥"
      - type: "dialogue"
        speaker: "char_002"
        lines: ["平安，今天赶集"]
        emotion: "爽朗"
      - type: "transition"
        content: "淡出"
```

## Demo 视频

[待录制]

## 依赖说明

### 后端

| 包 | 用途 |
|----|------|
| fastapi / uvicorn | Web 框架 |
| pydantic / pyyaml | 数据校验 / YAML |
| openai | LLM API（兼容 DeepSeek）|
| aiosqlite / pyjwt | 数据库 / 认证 |
| pytest / httpx | 测试 |

### 前端

| 包 | 用途 |
|----|------|
| react / react-dom | UI 框架 |
| vite / typescript | 构建工具 |
| tailwindcss | CSS |
| js-yaml | 前端 YAML 生成 |
