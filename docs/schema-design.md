# 剧本 YAML Schema 设计文档

## 概述

本文档定义了一套用于结构化存储剧本的 YAML Schema 格式，用于 AI 小说转剧本工具。

## Schema 设计目标

1. **可读性强**：人可以直接阅读和编辑 YAML 文件
2. **完整性**：覆盖剧本所需的角色、场景、对话、动作、转场等元素
3. **可扩展**：字段设计允许后续增加新类型和属性
4. **机器友好**：结构化程度足够高，可被程序解析和处理

## 完整 Schema 示例

```yaml
meta:
  title: "剧本标题"
  original_work: "原著小说名"
  original_author: "原著作者"
  adapter: "改编者"
  version: "1.0"

characters:
  - id: "char_001"
    name: "角色名"
    role: "主角"            # 主角 / 配角 / 龙套
    description: "身份背景描述"
    traits: ["标签1", "标签2"]
    relationships:
      - target: "char_002"
        relation: "关系描述"

scenes:
  - scene_number: 1
    location:
      name: "场景地点"
      time: "时间"
      description: "环境描述"
    characters_present: ["char_001", "char_002"]
    elements:
      - type: "action"
        content: "动作描述"
      - type: "dialogue"
        speaker: "char_001"
        lines:
          - "台词行1"
          - "台词行2"
        emotion: "情绪"
        notes: "表演备注"
      - type: "transition"
        content: "转场描述"
```

## 字段说明

### meta — 剧本元信息

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 剧本标题 |
| original_work | string | 是 | 原著小说名称 |
| original_author | string | 是 | 原著作者 |
| adapter | string | 否 | 改编者，默认为空 |
| version | string | 否 | 版本号，默认 "1.0" |

### characters — 角色表

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 角色唯一标识，格式 `char_NNN` |
| name | string | 是 | 角色姓名 |
| role | enum | 是 | 主角 / 配角 / 龙套 |
| description | string | 是 | 身份背景描述 |
| traits | list[string] | 否 | 性格标签列表 |
| relationships | list[Relationship] | 否 | 角色关系列表 |

#### Relationship

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| target | string | 是 | 目标角色 ID |
| relation | string | 是 | 关系描述 |

### scenes — 场景列表

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| scene_number | int | 是 | 场景序号 |
| location | Location | 是 | 场景地点信息 |
| characters_present | list[string] | 是 | 在场角色 ID 列表 |
| elements | list[Element] | 是 | 按时间排列的场景元素 |

#### Location

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 地点名称 |
| time | string | 是 | 时间（白天/夜晚/清晨等）|
| description | string | 否 | 环境描述 |

#### Scene Element — 场景元素

场景元素有三种类型（type），按时间顺序在 `elements` 数组中混排：

**action（动作/舞台指示）**

| 字段 | 值 | 说明 |
|------|-----|------|
| type | "action" | 固定值 |
| content | string | 动作或舞台指示描述 |

**dialogue（对话）**

| 字段 | 值 | 说明 |
|------|-----|------|
| type | "dialogue" | 固定值 |
| speaker | string | 说话角色 ID |
| lines | list[string] | 台词行列表 |
| emotion | string | 情绪/语气（可选）|
| notes | string | 表演备注（可选）|

**transition（转场）**

| 字段 | 值 | 说明 |
|------|-----|------|
| type | "transition" | 固定值 |
| content | string | 转场描述 |

## 设计决策说明

### 1. 为什么 elements 是混合数组而不是分类存储？

如果分类存储（action 数组 + dialogue 数组 + transition 数组），就需要通过额外的索引字段来维护它们之间的顺序关系，这会增加数据复杂度和阅读难度。混合数组按时间顺序排列，遍历一次即可获得完整的演出流程。

### 2. 为什么需要 characters_present 字段？

虽然通过遍历场景中的 dialogue 可以推断出在场角色，但：
- 某些角色可能在场但没有台词（背景角色）
- 预声明在场角色方便灯光、道具等部门快速了解每个场景的人员需求
- 避免遗漏在行动描述中出现但无台词的角色

### 3. 为什么对话使用角色 ID 而非角色名？

- 角色名可能在改编过程中修改，使用 ID 可以保持引用一致性
- 一次性改名后，所有对话引用自动关联
- 输出时可通过 ID → Name 映射渲染为可读格式

### 4. 为什么选择 YAML 格式？

- 与 JSON 相比，YAML 可读性更好，支持注释
- 作为业界标准配置格式，创作者可以直观地阅读和编辑
- 支持多行字符串，适合台词等长文本
- 与 Python 生态深度整合（PyYAML）
