import { useState } from 'react'
import type { Script, Scene } from '../types'

interface Props {
  script: Script
  onReorder?: (scenes: Scene[]) => void
}

export default function SceneCards({ script, onReorder }: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const charMap = new Map(script.characters.map((c) => [c.id, c.name]))

  const handleDragStart = (idx: number) => setDragIdx(idx)
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setOverIdx(idx) }
  const handleDragEnd = () => {
    if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx && onReorder) {
      const copy = [...script.scenes]
      const [moved] = copy.splice(dragIdx, 1)
      copy.splice(overIdx, 0, moved)
      copy.forEach((s, i) => { s.scene_number = i + 1 })
      onReorder(copy)
    }
    setDragIdx(null); setOverIdx(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs text-warm-gray">{script.scenes.length} 个场景</h4>
        <p className="text-[10px] text-warm-gray-light">拖拽卡片重新排序</p>
      </div>
      <div className="grid gap-2 max-h-[500px] overflow-auto pr-1">
        {script.scenes.map((scene, i) => {
          const loc = scene.location
          const dialogueCount = scene.elements.filter((e: any) => e.type === 'dialogue').length
          const actionCount = scene.elements.filter((e: any) => e.type === 'action').length
          const chars = (scene.characters_present || []).map((id: string) => charMap.get(id) || id).join(', ')

          return (
            <div
              key={i}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDragEnd={handleDragEnd}
              className={`card-warm p-3 cursor-grab active:cursor-grabbing transition-colors ${
                dragIdx === i ? 'opacity-40' : ''
              } ${overIdx === i && dragIdx !== i ? 'ring-2 ring-ink/20' : ''}`}
            >
              <div className="flex items-start gap-3">
                {/* Drag handle */}
                <div className="text-border mt-0.5 text-xs shrink-0 cursor-grab select-none">⬍</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-warm-gray-light bg-soft-amber px-1.5 py-0.5 rounded">
                      SCENE {scene.scene_number}
                    </span>
                    <div className="flex items-center gap-2 text-[10px] text-warm-gray-light">
                      <span>{dialogueCount} 对话</span>
                      <span>{actionCount} 动作</span>
                    </div>
                  </div>
                  <p className="text-xs font-medium text-ink mb-0.5">
                    {loc.name} · {loc.time}
                  </p>
                  {loc.description && (
                    <p className="text-[11px] text-warm-gray-light leading-relaxed truncate">
                      {loc.description}
                    </p>
                  )}
                  {chars && (
                    <p className="text-[10px] text-warm-gray-light mt-1 truncate">
                      出场：{chars}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
