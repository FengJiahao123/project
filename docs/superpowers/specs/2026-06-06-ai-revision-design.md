# AI 协作修改剧本 — 设计文档

> 日期：2026-06-06
> 状态：已确认

## 1. 概述

在剧本预览 Tab 中增加 AI 协作侧边栏，用户通过自然语言指令修改剧本，AI 返回修改后的完整剧本，用户可预览差异、确认应用或撤销。

## 2. 技术方案

### 后端：新增 /api/revision 接口

```
POST /api/revision
  输入：{ script_json, instruction, history? }
  处理：将完整剧本 + 用户指令发给 LLM，要求返回修改后的完整 JSON
  输出：{ modified_script_json, message }
```

Prompt 设计要点：
- 输入完整剧本 JSON + 用户指令
- 要求 LLM 只修改指令涉及的部分，其他保持原样
- 返回完整 JSON，不返回 diff
- 可选传入历史对话记录保持上下文

### 前端：ScriptPreview 集成 AI 侧边栏

```
ScriptPreview 工具栏新增 [💬 AI 协作] 切换按钮
  ↓ 点击
  布局变为左右分栏：
    ┌─ 剧本预览 ───────────┬─ 💬 AI 协作 ──────┐
    │                      │                    │
    │  SCENE 1             │ 指令输入框         │
    │  陈平安...           │        [发送]      │
    │                      │ ───────────────    │
    │  SCENE 2             │ 🤖 AI 回复...      │
    │  ...                 │                    │
    │                      │ [👁 预览修改]      │
    │                      │ [✅ 确认应用]      │
    │                      │ [↩ 撤销]          │
    └──────────────────────┴────────────────────┘
```

状态管理：
- ResultPanel 持有脚本的可变副本（mutableScript state）
- 初始值来自 props.script
- AI 返回修改后 → 切换显示修改版
- 确认应用 → mutableScript 更新为修改版，所有 Tab 刷新
- 撤销 → 恢复上一个版本

## 3. 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| backend: router.py | 修改 | 新增 /api/revision 端点 |
| backend: models.py | 修改 | 新增 RevisionRequest/RevisionResponse |
| frontend: ScriptPreview.tsx | 修改 | 集成 AI 聊天侧边栏 |
| frontend: ResultPanel.tsx | 修改 | script 状态提升为本地的 mutableScript |
| frontend: api.ts | 修改 | 新增 submitRevision() |
| frontend: types.ts | 修改 | 新增 RevisionRequest/RevisionResponse 类型 |
