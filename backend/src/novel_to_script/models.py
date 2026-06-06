"""Pydantic 数据模型 — 剧本 YAML Schema 与 API 请求/响应"""

from pydantic import BaseModel, Field
from typing import Literal


# ====== 剧本 YAML Schema ======

class Relationship(BaseModel):
    target: str = Field(..., description="关联角色的 ID")
    relation: str = Field(..., description="关系描述，如'朋友'、'父子'")


class Character(BaseModel):
    id: str = Field(..., description="角色唯一标识，如 char_001")
    name: str = Field(..., description="角色姓名")
    role: Literal["主角", "配角", "龙套"] = Field(..., description="角色定位")
    description: str = Field(..., description="身份背景描述")
    traits: list[str] = Field(default_factory=list, description="性格标签")
    relationships: list[Relationship] = Field(
        default_factory=list, description="与其他角色的关系"
    )


class Meta(BaseModel):
    title: str = Field(..., description="剧本标题")
    original_work: str = Field(..., description="原著小说名")
    original_author: str = Field(..., description="原著作者")
    adapter: str = Field(default="", description="改编者")
    version: str = Field(default="1.0", description="版本号")


class Location(BaseModel):
    name: str = Field(..., description="场景地点名称")
    time: str = Field(..., description="时间，如'白天'、'夜晚'、'清晨'")
    description: str = Field(default="", description="环境描述")


class ActionElement(BaseModel):
    type: Literal["action"] = "action"
    content: str = Field(..., description="动作/舞台指示内容")


class DialogueElement(BaseModel):
    type: Literal["dialogue"] = "dialogue"
    speaker: str = Field(..., description="说话角色的 ID")
    lines: list[str] = Field(..., description="台词列表")
    emotion: str = Field(default="", description="情绪/语气")
    notes: str = Field(default="", description="表演备注")


class TransitionElement(BaseModel):
    type: Literal["transition"] = "transition"
    content: str = Field(..., description="转场描述，如'淡出至黑场'")


SceneElement = ActionElement | DialogueElement | TransitionElement


class Scene(BaseModel):
    scene_number: int = Field(..., description="场景编号")
    location: Location = Field(..., description="场景地点信息")
    characters_present: list[str] = Field(
        default_factory=list, description="本场景中出现的角色 ID 列表"
    )
    elements: list[SceneElement] = Field(
        default_factory=list, description="按时间顺序排列的场景元素"
    )


class Script(BaseModel):
    """完整剧本"""
    meta: Meta = Field(..., description="剧本元信息")
    characters: list[Character] = Field(..., description="角色表")
    scenes: list[Scene] = Field(default_factory=list, description="场景列表")


# ====== API 请求/响应 ======

class ConvertRequest(BaseModel):
    text: str = Field(..., min_length=1, description="小说全文文本")


class ConvertResponse(BaseModel):
    task_id: str | None = Field(default=None, description="任务 ID，用于轮询进度")
    status: Literal["pending", "processing", "completed", "error"] = Field(
        ..., description="转换状态"
    )
    progress: int = Field(default=0, ge=0, le=100, description="进度百分比")
    chapters: list[str] = Field(
        default_factory=list, description="已识别的章节标题列表"
    )
    script: Script | None = Field(default=None, description="转换完成的剧本")
    error: str | None = Field(default=None, description="错误信息")
