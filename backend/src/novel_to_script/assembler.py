"""剧本组装与校验 — 合并多章结果为完整剧本，输出 YAML"""

import yaml
from novel_to_script.models import Script, Meta, Character, Scene


def assemble_script(
    meta: Meta,
    all_characters: list[Character],
    all_scenes: list[Scene],
) -> Script:
    """将多个章节的角色和场景组装成完整剧本。

    - 角色按 id 去重
    - 场景按顺序重新编号
    - 校验 characters_present 和 dialogue speaker 引用的角色 ID 有效

    Args:
        meta: 剧本元信息
        all_characters: 所有章节的角色列表（可能重复）
        all_scenes: 所有章节的场景列表

    Returns:
        组装完成的完整 Script 对象

    Raises:
        ValueError: 场景引用了不存在的角色 ID
    """
    # 角色去重（按 id，保留首次出现）
    seen_ids: set[str] = set()
    unique_chars: list[Character] = []
    for char in all_characters:
        if char.id not in seen_ids:
            seen_ids.add(char.id)
            unique_chars.append(char)

    # 校验角色引用
    for scene in all_scenes:
        for char_id in scene.characters_present:
            if char_id not in seen_ids:
                raise ValueError(
                    f"场景 {scene.scene_number} 引用了不存在的角色 ID: {char_id}"
                )
        for element in scene.elements:
            if element.type == "dialogue":
                if element.speaker not in seen_ids:
                    raise ValueError(
                        f"场景 {scene.scene_number} 的对话引用了不存在的角色 ID: {element.speaker}"
                    )

    # 重新编号场景
    for i, scene in enumerate(all_scenes, start=1):
        scene.scene_number = i

    return Script(
        meta=meta,
        characters=unique_chars,
        scenes=all_scenes,
    )


def to_yaml(script: Script) -> str:
    """将 Script 对象序列化为 YAML 字符串。

    Args:
        script: Script 对象

    Returns:
        格式化的 YAML 字符串
    """
    return yaml.dump(
        script.model_dump(exclude_none=True),
        allow_unicode=True,
        default_flow_style=False,
        sort_keys=False,
        indent=2,
    )
