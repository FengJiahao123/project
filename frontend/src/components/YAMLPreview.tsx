import { useMemo } from 'react'
import yaml from 'js-yaml'
import type { Script } from '../types'

interface Props {
  script: Script
}

/** 清理 Script 对象，移除空值以便 YAML 输出更干净 */
function cleanForYaml(script: Script): Record<string, unknown> {
  return {
    meta: {
      title: script.meta.title,
      original_work: script.meta.original_work,
      original_author: script.meta.original_author,
      ...(script.meta.adapter ? { adapter: script.meta.adapter } : {}),
      ...(script.meta.version !== '1.0' ? { version: script.meta.version } : {}),
    },
    characters: script.characters.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      description: c.description,
      ...(c.traits.length > 0 ? { traits: c.traits } : {}),
      ...(c.relationships.length > 0
        ? {
            relationships: c.relationships.map((r) => ({
              target: r.target,
              relation: r.relation,
            })),
          }
        : {}),
    })),
    scenes: script.scenes.map((s) => ({
      scene_number: s.scene_number,
      location: {
        name: s.location.name,
        time: s.location.time,
        ...(s.location.description ? { description: s.location.description } : {}),
      },
      ...(s.characters_present.length > 0
        ? { characters_present: s.characters_present }
        : {}),
      elements: s.elements.map((el) => {
        if (el.type === 'action') return { type: 'action', content: el.content }
        if (el.type === 'transition')
          return { type: 'transition', content: el.content }
        return {
          type: 'dialogue',
          speaker: el.speaker,
          lines: el.lines,
          ...(el.emotion ? { emotion: el.emotion } : {}),
          ...(el.notes ? { notes: el.notes } : {}),
        }
      }),
    })),
  }
}

export default function YAMLPreview({ script }: Props) {
  const yamlString = useMemo(() => {
    const cleaned = cleanForYaml(script)
    return yaml.dump(cleaned, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    })
  }, [script])

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-600">剧本 YAML 内容</h4>
        <button
          onClick={() => navigator.clipboard.writeText(yamlString)}
          className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          📋 复制到剪贴板
        </button>
      </div>
      <pre
        className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-auto max-h-[500px]
                      font-mono leading-relaxed"
      >
        {yamlString}
      </pre>
    </div>
  )
}
