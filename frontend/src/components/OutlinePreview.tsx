import { useState } from 'react'
import type { OutlineResponse, OutlineScene } from '../types'

interface Props {
  outline: OutlineResponse
  onConfirm: (editedOutline: OutlineResponse) => void
  onRetry: () => void
  loading: boolean
}

type EditTarget = {
  kind: 'sceneSummary' | 'sceneLocation' | 'sceneTime' | 'sceneDialogue' | 'sceneCharAdd' | 'sceneCharRemove'
  chIdx: number; sceneIdx: number
} | {
  kind: 'charName' | 'charRole'
  charIdx: number
} | {
  kind: 'addScene'; chIdx: number; afterSceneIdx: number
} | {
  kind: 'deleteScene'; chIdx: number; sceneIdx: number
} | {
  kind: 'addChar'
} | {
  kind: 'note'
} | null

export default function OutlinePreview({ outline, onConfirm, onRetry, loading }: Props) {
  // Mutable copy of outline
  const [editable, setEditable] = useState(structuredClone(outline))
  const [editTarget, setEditTarget] = useState<EditTarget>(null)
  const [editValue, setEditValue] = useState('')
  const [charInput, setCharInput] = useState('')

  const roleLabel = (role: string) => {
    switch (role) {
      case 'protagonist': return '主角'
      case 'supporting': return '配角'
      case 'extra': return '龙套'
      default: return role || '配角'
    }
  }
  const roleColor = (role: string) => {
    switch (role) {
      case 'protagonist': return 'bg-amber-100 text-amber-700'
      case 'supporting': return 'bg-blue-100 text-blue-700'
      default: return 'bg-gray-200 text-gray-600'
    }
  }

  // Recompute total_scenes
  const totalScenes = editable.chapter_outlines.reduce((sum, ch) => sum + ch.scenes.length, 0)

  const startEdit = (t: EditTarget & {}, val: string) => { setEditTarget(t); setEditValue(val) }
  const cancelEdit = () => setEditTarget(null)

  const applyEdit = () => {
    if (!editTarget) return
    const copy = structuredClone(editable)

    if (editTarget.kind === 'sceneSummary') {
      copy.chapter_outlines[editTarget.chIdx].scenes[editTarget.sceneIdx].summary = editValue
    } else if (editTarget.kind === 'sceneLocation') {
      copy.chapter_outlines[editTarget.chIdx].scenes[editTarget.sceneIdx].location_name = editValue
    } else if (editTarget.kind === 'sceneTime') {
      copy.chapter_outlines[editTarget.chIdx].scenes[editTarget.sceneIdx].time = editValue
    } else if (editTarget.kind === 'sceneDialogue') {
      copy.chapter_outlines[editTarget.chIdx].scenes[editTarget.sceneIdx].key_dialogue_preview = editValue
    } else if (editTarget.kind === 'charName') {
      copy.character_preview[editTarget.charIdx].name = editValue
    } else if (editTarget.kind === 'charRole') {
      copy.character_preview[editTarget.charIdx].role_guess = editValue
    } else if (editTarget.kind === 'sceneCharRemove') {
      const scene = copy.chapter_outlines[editTarget.chIdx].scenes[editTarget.sceneIdx]
      scene.characters_involved = scene.characters_involved.filter((n: string) => n !== editValue)
    } else if (editTarget.kind === 'deleteScene') {
      copy.chapter_outlines[editTarget.chIdx].scenes.splice(editTarget.sceneIdx, 1)
    } else if (editTarget.kind === 'addScene') {
      const newScene: OutlineScene = {
        scene_number: 0,
        location_name: editValue || '新场景',
        time: '白天',
        summary: '（在此编辑场景摘要）',
        characters_involved: [],
      }
      copy.chapter_outlines[editTarget.chIdx].scenes.splice(editTarget.afterSceneIdx + 1, 0, newScene)
    } else if (editTarget.kind === 'addChar') {
      if (editValue.trim()) {
        copy.character_preview.push({
          name: editValue.trim(),
          role_guess: 'supporting',
          brief_intro: '',
          first_appearance_scene: 1,
        })
      }
    } else if (editTarget.kind === 'note') {
      copy.analysis_notes = editValue
    }

    setEditable(copy)
    setEditTarget(null)
  }

  const handleAddChar = () => {
    if (!charInput.trim()) return
    const copy = structuredClone(editable)
    copy.character_preview.push({
      name: charInput.trim(), role_guess: 'supporting', brief_intro: '', first_appearance_scene: 1,
    })
    setEditable(copy)
    setCharInput('')
  }

  const handleRemoveChar = (idx: number) => {
    const copy = structuredClone(editable)
    copy.character_preview.splice(idx, 1)
    setEditable(copy)
  }

  const editPopover = () => {
    if (!editTarget) return null
    const multiline = editTarget.kind === 'sceneSummary' || editTarget.kind === 'note'
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={cancelEdit}>
        <div className="bg-white rounded-xl shadow-2xl p-5 w-[460px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm font-semibold text-gray-700 mb-3">编辑</p>
          {multiline ? (
            <textarea className="flex-1 p-3 border border-gray-300 rounded-lg text-sm resize-none min-h-[100px]" value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
          ) : (
            <input className="p-3 border border-gray-300 rounded-lg text-sm" value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
          )}
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={cancelEdit} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">取消</button>
            <button onClick={applyEdit} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">保存</button>
          </div>
        </div>
      </div>
    )
  }

  const EditHint = () => <span className="ml-1 opacity-0 group-hover:opacity-100 text-[10px] text-indigo-400 cursor-pointer transition-opacity">✎</span>

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
      {editPopover()}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          📋 大纲预览 <span className="text-xs text-gray-400 font-normal ml-2">（点击任意内容即可编辑）</span>
        </h2>
        <div className="flex items-center gap-3">
          <button onClick={onRetry} disabled={loading}
            className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors">
            🔄 AI 重新分析
          </button>
          <button onClick={() => onConfirm(editable)} disabled={loading}
            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            ✅ 确认大纲，开始生成
          </button>
        </div>
      </div>

      {/* Chapter list */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
        <span>📖 已识别 {editable.chapter_titles.length} 个章节：</span>
        {editable.chapter_titles.map((t, i) => (
          <span key={i}>
            <span className="font-medium text-indigo-600">{t}</span>
            {i < editable.chapter_titles.length - 1 && <span className="mx-1 text-gray-300">·</span>}
          </span>
        ))}
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-5 p-3 bg-gray-50 rounded-lg">
        <StatBadge label="场景" value={totalScenes.toString()} />
        <StatBadge label="角色" value={editable.character_preview.length.toString()} />
        <StatBadge label="章节" value={editable.chapter_outlines.length.toString()} />
      </div>

      {/* Scenes */}
      <div className="space-y-4 mb-5">
        {editable.chapter_outlines.map((ch, chi) => (
          <div key={chi} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">
                📄 {ch.chapter_title}
                <span className="ml-2 text-xs text-gray-400 font-normal">{ch.scenes.length} 个场景</span>
              </h3>
              <button
                onClick={() => setEditTarget({ kind: 'addScene', chIdx: chi, afterSceneIdx: ch.scenes.length - 1 })}
                className="text-xs text-indigo-600 hover:text-indigo-800">+ 添加场景</button>
            </div>
            <div className="divide-y divide-gray-100">
              {ch.scenes.map((scene, si) => (
                <div key={si} className="px-4 py-3 hover:bg-indigo-50/30 transition-colors group">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-mono font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded mt-0.5 shrink-0">
                      {scene.scene_number || (si + 1)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium text-gray-800 group cursor-pointer"
                          onClick={() => startEdit({ kind: 'sceneLocation', sceneIdx: si, chIdx: chi }, scene.location_name)}>
                          {scene.location_name}<EditHint />
                        </span>
                        <span className="text-xs text-gray-400 cursor-pointer"
                          onClick={() => startEdit({ kind: 'sceneTime', sceneIdx: si, chIdx: chi }, scene.time)}>
                          — {scene.time}<EditHint />
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed cursor-pointer"
                        onClick={() => startEdit({ kind: 'sceneSummary', sceneIdx: si, chIdx: chi }, scene.summary)}>
                        {scene.summary}<EditHint />
                      </p>
                      {scene.key_dialogue_preview && (
                        <p className="text-xs text-indigo-500 mt-1 italic cursor-pointer"
                          onClick={() => startEdit({ kind: 'sceneDialogue', sceneIdx: si, chIdx: chi }, scene.key_dialogue_preview || '')}>
                          💬 "{scene.key_dialogue_preview}"<EditHint />
                        </p>
                      )}
                      {!scene.key_dialogue_preview && (
                        <p className="text-xs text-gray-300 mt-1 italic cursor-pointer"
                          onClick={() => startEdit({ kind: 'sceneDialogue', sceneIdx: si, chIdx: chi }, '')}>
                          （点击添加关键对话预览）
                        </p>
                      )}

                      {/* Characters + actions */}
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        {scene.characters_involved.map((name) => (
                          <span key={name} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex items-center gap-1 group/char">
                            {name}
                            <button className="text-red-400 hover:text-red-600 opacity-0 group-hover/char:opacity-100 text-xs leading-none"
                              onClick={() => {
                                const copy = structuredClone(editable)
                                const sc = copy.chapter_outlines[chi].scenes[si]
                                sc.characters_involved = sc.characters_involved.filter((n: string) => n !== name)
                                setEditable(copy)
                              }}>×</button>
                          </span>
                        ))}
                        <button className="text-[10px] text-indigo-400 hover:text-indigo-600 px-1"
                          onClick={() => {
                            const name = prompt('添加角色到本场景：')
                            if (name?.trim()) {
                              const copy = structuredClone(editable)
                              copy.chapter_outlines[chi].scenes[si].characters_involved.push(name.trim())
                              setEditable(copy)
                            }
                          }}>
                          +角色
                        </button>
                      </div>
                    </div>

                    {/* Scene actions */}
                    <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button className="text-[10px] text-red-400 hover:text-red-600"
                        onClick={() => { const copy = structuredClone(editable); copy.chapter_outlines[chi].scenes.splice(si, 1); setEditable(copy) }}
                        title="删除此场景">✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Characters — editable */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gray-700">
            👤 角色（{editable.character_preview.length}人）
          </h3>
          <div className="flex items-center gap-1">
            <input
              className="text-xs px-2 py-1 border border-gray-300 rounded w-24"
              placeholder="新角色名..."
              value={charInput}
              onChange={(e) => setCharInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddChar() }}
            />
            <button onClick={handleAddChar} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
              +添加
            </button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {editable.character_preview.map((c, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg group">
              <span className="text-sm font-medium text-gray-800 cursor-pointer"
                onClick={() => startEdit({ kind: 'charName', charIdx: i }, c.name)}>
                {c.name}<EditHint />
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${roleColor(c.role_guess)} cursor-pointer`}
                onClick={() => {
                  const roles = ['protagonist', 'supporting', 'extra']
                  const currentIdx = roles.indexOf(c.role_guess)
                  const next = roles[(currentIdx + 1) % roles.length]
                  const copy = structuredClone(editable)
                  copy.character_preview[i].role_guess = next
                  setEditable(copy)
                }}
                title="点击切换主角/配角/龙套">
                {roleLabel(c.role_guess)}
              </span>
              <span className="text-[10px] text-gray-400">场景{c.first_appearance_scene}</span>
              <button className="ml-auto text-red-400 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100"
                onClick={() => handleRemoveChar(i)}>✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* Notes — editable */}
      <div className="p-3 bg-indigo-50 rounded-lg text-xs text-indigo-700 leading-relaxed group cursor-pointer"
        onClick={() => startEdit({ kind: 'note' }, editable.analysis_notes)}>
        💡 {editable.analysis_notes || '（点击添加备注...）'}<EditHint />
      </div>

      {/* Bottom */}
      <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-200">
        <button onClick={onRetry} disabled={loading}
          className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors">
          🔄 AI 重新分析
        </button>
        <button onClick={() => onConfirm(editable)} disabled={loading}
          className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          ✅ 确认大纲，开始生成剧本
        </button>
      </div>
    </div>
  )
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-lg font-bold text-indigo-600">{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  )
}
