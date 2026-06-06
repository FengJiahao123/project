"""剧本组装与校验 — 合并多章结果为完整剧本，输出 YAML"""

import re
import yaml
from novel_to_script.models import Script, Meta, Character, Scene


def merge_chapter_result(
    existing_characters: list[Character],
    new_characters: list[Character],
    new_scenes: list[Scene],
) -> tuple[list[Character], list[Scene]]:
    """将新章节的角色和场景合并到已有角色表中。

    按角色名称（去除首尾空白后）匹配已有角色：
    - 名称匹配 → 复用已有角色的 ID，避免跨章 ID 冲突
    - 新角色 → 分配全局唯一 ID（char_NNN 递增）
    - 自动更新场景中 characters_present 和 dialogue.speaker 的 ID 引用

    Args:
        existing_characters: 前面章节已累积的角色列表
        new_characters: 当前章节 LLM 返回的新角色列表（ID 可能和已有角色冲突）
        new_scenes: 当前章节的场景列表

    Returns:
        (合并后的全部角色列表, 更新了 ID 引用的场景列表)
    """
    # 1. 建立已有角色 name → id 映射
    name_to_id: dict[str, str] = {}
    for c in existing_characters:
        key = c.name.strip()
        name_to_id[key] = c.id

    # 2. 计算下一个可用 ID 编号
    max_num = 0
    for c in existing_characters:
        m = re.match(r"char_(\d+)", c.id)
        if m:
            max_num = max(max_num, int(m.group(1)))
    next_num = max_num + 1

    # 3. 为当前章节的角色建立 ID 映射（旧 ID → 新 ID）
    id_map: dict[str, str] = {}
    merged_chars = list(existing_characters)

    for c in new_characters:
        name_key = c.name.strip()
        if name_key in name_to_id:
            # 角色已存在 → 映射到已有 ID
            id_map[c.id] = name_to_id[name_key]
        else:
            # 新角色 → 分配新 ID
            new_id = f"char_{next_num:03d}"
            id_map[c.id] = new_id
            name_to_id[name_key] = new_id
            next_num += 1
            c.id = new_id
            merged_chars.append(c)

    # 4. 更新新场景中的角色 ID 引用
    for scene in new_scenes:
        scene.characters_present = [
            id_map.get(cid, cid) for cid in scene.characters_present
        ]
        for elem in scene.elements:
            if elem.type == "dialogue":
                elem.speaker = id_map.get(elem.speaker, elem.speaker)

    # 5. 更新新增角色中 relationships 的 target 引用
    for c in merged_chars:
        for rel in c.relationships:
            rel.target = id_map.get(rel.target, rel.target)

    return merged_chars, new_scenes


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
