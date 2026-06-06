import { useState, useCallback } from 'react'
import { submitRevision } from '../api'
import type { Script } from '../types'

interface Props {
  script: Script
  onScriptUpdate?: (script: Script) => void
}

type EditTarget =
  | { type: 'action'; sceneIdx: number; elemIdx: number; field: 'content' }
  | { type: 'dialogue'; sceneIdx: number; elemIdx: number; field: 'speaker' | 'lines' | 'emotion' | 'notes' }
  | { type: 'transition'; sceneIdx: number; elemIdx: number; field: 'content' }
  | { type: 'location'; sceneIdx: number; field: 'name' | 'time' | 'description' }
  | { type: 'sceneDesc'; sceneIdx: number }
  | { type: 'title' }
  | { type: 'charTrait'; charId: string; traitIdx: number }
  | { type: 'charDesc'; charId: string }
  | null

const SCENE_SEPARATOR = '─'.repeat(60)

export default function ScriptPreview({ script, onScriptUpdate }: Props) {
  const [darkMode, setDarkMode] = useState(false)
  const [copied, setCopied] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  // Inline editing
  const [editTarget, setEditTarget] = useState<EditTarget>(null)
  const [editValue, setEditValue] = useState('')

  // Chat state
  const [instruction, setInstruction] = useState('')
  const [chatMessages, setChatMessages] = useState<
    { role: 'user' | 'ai'; text: string; changes?: string[] }[]
  >([])
  const [chatLoading, setChatLoading] = useState(false)
  const [pendingScript, setPendingScript] = useState<Script | null>(null)
  const [revisionCount, setRevisionCount] = useState(0)

  const charMap = new Map(script.characters.map((c) => [c.id, c.name]))
  const idToChar = new Map(script.characters.map((c) => [c.id, c]))
  const nameToId = new Map(script.characters.map((c) => [c.name, c.id]))

  /** Deep clone the script, apply edit, propagate */
  const applyEdit = useCallback(
    (target: EditTarget & {}, value: string) => {
      if (!target || !onScriptUpdate) return
      const s = JSON.parse(JSON.stringify(script)) as Script

      if (target.type === 'title') {
        s.meta.title = value
      } else if (target.type === 'action' || target.type === 'transition') {
        const el = s.scenes[target.sceneIdx].elements[target.elemIdx]
        if (el.type === target.type) (el as Record<string, unknown>)[target.field] = value
      } else if (target.type === 'dialogue') {
        const el = s.scenes[target.sceneIdx].elements[target.elemIdx] as Record<string, unknown>
        if (target.field === 'lines') {
          el['lines'] = value.split('\n').filter((l: string) => l.trim())
        } else if (target.field === 'speaker') {
          // Resolve speaker name or ID
          const name = value.trim()
          const existingId = nameToId.get(name)
          el['speaker'] = existingId || name
        } else {
          el[target.field] = value
        }
      } else if (target.type === 'location') {
        const loc = s.scenes[target.sceneIdx].location as unknown as Record<string, unknown>
        loc[target.field] = value
      } else if (target.type === 'sceneDesc') {
        s.scenes[target.sceneIdx].location.description = value
      } else if (target.type === 'charDesc') {
        const c = idToChar.get(target.charId)
        if (c) c.description = value
      } else if (target.type === 'charTrait') {
        const c = idToChar.get(target.charId)
        if (c && c.traits[target.traitIdx] !== undefined) {
          if (value.trim()) {
            c.traits[target.traitIdx] = value.trim()
          } else {
            c.traits.splice(target.traitIdx, 1) // remove empty trait
          }
        }
      }

      onScriptUpdate(s)
      setEditTarget(null)
    },
    [script, onScriptUpdate, idToChar, nameToId],
  )

  const startEdit = (target: EditTarget & {}, currentValue: string) => {
    setEditTarget(target)
    setEditValue(currentValue)
  }

  const cancelEdit = () => setEditTarget(null)

  // Build plain text for copy/download
  const buildTextScript = useCallback(() => {
    const lines: string[] = []
    lines.push(script.meta.title || '剧本')
    lines.push('')
    lines.push('='.repeat(60))
    lines.push('')
    for (const scene of script.scenes) {
      const loc = scene.location
      lines.push(`SCENE ${scene.scene_number} — ${loc.name} — ${loc.time}`)
      if (loc.description) lines.push(`  ${loc.description}`)
      lines.push('')
      for (const el of scene.elements) {
        if (el.type === 'action') {
          lines.push(el.content); lines.push('')
        } else if (el.type === 'dialogue') {
          lines.push(`                    ${charMap.get(el.speaker) || el.speaker}`)
          lines.push('')
          for (const line of el.lines) lines.push(`          ${line}`)
          if (el.emotion) lines.push(`                    （${el.emotion}）`)
          lines.push('')
        } else if (el.type === 'transition') {
          lines.push(`                                          ${el.content}`)
          lines.push('')
        }
      }
      lines.push(SCENE_SEPARATOR); lines.push('')
    }
    return lines.join('\n')
  }, [script, charMap])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildTextScript())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrint = () => {
    const text = buildTextScript()
    const w = window.open('', '_blank', 'width=800,height=600')
    if (!w) return
    w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${script.meta.title || '剧本'}</title>
<style>
  body { font-family: "Courier New", Courier, monospace; font-size: 12pt; line-height: 1.8; max-width: 650px; margin: 40px auto; padding: 0 20px; color: #000; }
  pre { white-space: pre-wrap; font-family: inherit; }
</style></head><body><pre>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
<script>window.onload=function(){window.print();window.close()}<\/script></body></html>`)
    w.document.close()
  }

  const handleSend = async () => {
    if (!instruction.trim() || chatLoading) return
    const userText = instruction.trim()
    setInstruction('')
    setChatLoading(true)
    setChatMessages((prev) => [...prev, { role: 'user', text: userText }])
    try {
      const resp = await submitRevision(script, userText)
      setChatMessages((prev) => [...prev, { role: 'ai', text: resp.message, changes: resp.changes_summary }])
      setPendingScript(resp.modified_script)
    } catch (e) {
      setChatMessages((prev) => [...prev, { role: 'ai', text: `❌ ${e instanceof Error ? e.message : '修改失败，请重试'}` }])
    } finally {
      setChatLoading(false)
    }
  }

  const handleAccept = () => {
    if (pendingScript && onScriptUpdate) {
      onScriptUpdate(pendingScript)
      setRevisionCount((c) => c + 1)
    }
    setPendingScript(null)
  }

  const handleReject = () => setPendingScript(null)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // ====== Inline Edit Popover ======
  const renderEditPopover = () => {
    if (!editTarget) return null
    const isMultiline = editTarget.type === 'action' || editTarget.type === 'dialogue' || editTarget.type === 'sceneDesc' || editTarget.type === 'charDesc'
    const isLines = editTarget.type === 'dialogue' && editTarget.field === 'lines'
    const label = editTarget.type === 'dialogue'
      ? { speaker: '角色', lines: '台词（每行一句）', emotion: '情绪', notes: '备注' }[editTarget.field]
      : editTarget.type === 'location'
        ? { name: '地点名', time: '时间', description: '环境描述' }[editTarget.field]
        : editTarget.type === 'title' ? '剧本标题' : editTarget.type === 'charDesc' ? '角色描述' : editTarget.type === 'charTrait' ? '性格标签' : '内容'

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={cancelEdit}>
        <div className="bg-white rounded-xl shadow-2xl p-5 w-[480px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm font-semibold text-gray-700 mb-3">编辑 {label}</p>
          {isLines || isMultiline ? (
            <textarea
              className="flex-1 p-3 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-indigo-500 min-h-[120px]"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              autoFocus
              placeholder={isLines ? '每行一句台词...' : ''}
            />
          ) : (
            <input
              className="p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              autoFocus
            />
          )}
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={cancelEdit} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">取消</button>
            <button onClick={() => applyEdit(editTarget, editValue)} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">保存</button>
          </div>
        </div>
      </div>
    )
  }

  // ====== Render helpers ======
  const editable = !!onScriptUpdate

  const EditHint = ({ label }: { label: string }) =>
    editable ? (
      <span className="ml-1 opacity-0 group-hover:opacity-100 text-[10px] text-indigo-400 cursor-pointer transition-opacity" title={`点击编辑${label}`}>
        ✎
      </span>
    ) : null

  // Colors
  const bg = darkMode ? 'bg-gray-900' : 'bg-white'
  const actionColor = darkMode ? 'text-gray-200' : 'text-gray-800'
  const nameColor = darkMode ? 'text-blue-400' : 'text-gray-900'
  const dialogueColor = darkMode ? 'text-gray-100' : 'text-gray-800'
  const emotionColor = darkMode ? 'text-gray-400' : 'text-gray-500'
  const transitionColor = darkMode ? 'text-gray-400' : 'text-gray-500'
  const sceneColor = darkMode ? 'text-yellow-400' : 'text-gray-800'
  const sepColor = darkMode ? 'text-gray-600' : 'text-gray-300'

  return (
    <div>
      {renderEditPopover()}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-600">
          📜 剧本预览 {editable && <span className="text-[10px] text-gray-400 ml-1">（点击任意内容即可编辑）</span>}
          {revisionCount > 0 && <span className="ml-2 text-xs text-indigo-600">已修改 {revisionCount} 次</span>}
        </h4>
        <div className="flex items-center gap-2">
          <button onClick={() => setDarkMode(!darkMode)} title={darkMode ? '切换到亮色模式' : '切换到暗色模式'}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${darkMode ? 'bg-gray-700 text-yellow-400 border-gray-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
            {darkMode ? '☀️ 亮色' : '🌙 暗色'}
          </button>
          <button onClick={handlePrint} title="打印或导出为 PDF"
            className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            📥 打印
          </button>
          <button onClick={handleCopy} title="复制纯文本剧本到剪贴板"
            className="text-xs px-3 py-1.5 bg-white text-gray-600 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
            {copied ? '✅ 已复制' : '📋 复制'}
          </button>
          <button onClick={() => setChatOpen(!chatOpen)} title="用 AI 自然语言修改剧本"
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${chatOpen ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
            💬 AI 协作
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-0">
        <div className={`${chatOpen ? 'w-1/2 border-r border-gray-200' : 'w-full'}`}>
          <div className={`${bg} rounded-lg border border-gray-200 overflow-auto max-h-[600px]`}
            style={{ fontFamily: '"Courier New", Courier, "Noto Sans SC", monospace' }}>
            <div className="p-6 max-w-[600px] mx-auto" style={{ fontSize: '14px', lineHeight: '1.9' }}>

              {/* Title — clickable */}
              <div className="text-center mb-8">
                <h2 className={`text-xl font-bold ${nameColor} group cursor-pointer`}
                  onClick={() => editable && startEdit({ type: 'title' }, script.meta.title)}>
                  {script.meta.title || '剧本'}
                  <EditHint label="标题" />
                </h2>
                {script.meta.original_work && (
                  <p className={`text-xs mt-1 ${emotionColor}`}>
                    原著：《{script.meta.original_work}》
                    {script.meta.original_author !== '未知' && `　作者：${script.meta.original_author}`}
                  </p>
                )}
              </div>

              {script.scenes.map((scene, si) => {
                const loc = scene.location
                return (
                  <div key={si} className="mb-8">
                    <div className="text-center mb-5">
                      <h3 className={`text-sm font-bold tracking-[0.3em] uppercase ${sceneColor}`}>
                        SCENE {scene.scene_number}
                      </h3>

                      {/* Location — clickable */}
                      <p className={`text-xs mt-1 ${emotionColor}`}>
                        <span className="group cursor-pointer"
                          onClick={() => editable && startEdit({ type: 'location', sceneIdx: si, field: 'name' }, loc.name)}>
                          {loc.name}<EditHint label="地点" />
                        </span>
                        　—
                        <span className="group cursor-pointer"
                          onClick={() => editable && startEdit({ type: 'location', sceneIdx: si, field: 'time' }, loc.time)}>
                          {loc.time}<EditHint label="时间" />
                        </span>
                      </p>

                      {/* Scene Description — clickable */}
                      <p className={`text-xs italic ${emotionColor} mt-0.5 max-w-sm mx-auto group cursor-pointer`}
                        onClick={() => editable && startEdit({ type: 'sceneDesc', sceneIdx: si }, loc.description)}>
                        {loc.description || '（点击添加场景描述）'}
                        <EditHint label="场景描述" />
                      </p>
                    </div>

                    {scene.elements.map((el, ei) => {
                      if (el.type === 'action') {
                        return (
                          <p key={ei} className={`mb-3 ${actionColor} text-justify group cursor-pointer hover:bg-indigo-50 rounded px-1 -mx-1`}
                            onClick={() => editable && startEdit({ type: 'action', sceneIdx: si, elemIdx: ei, field: 'content' }, el.content)}>
                            {el.content}
                            <EditHint label="动作" />
                          </p>
                        )
                      }
                      if (el.type === 'transition') {
                        return (
                          <p key={ei} className={`mb-4 text-right text-sm ${transitionColor} group cursor-pointer hover:bg-indigo-50 rounded px-1`}
                            onClick={() => editable && startEdit({ type: 'transition', sceneIdx: si, elemIdx: ei, field: 'content' }, el.content)}>
                            {el.content}
                            <EditHint label="转场" />
                          </p>
                        )
                      }
                      if (el.type === 'dialogue') {
                        const name = charMap.get(el.speaker) || el.speaker
                        return (
                          <div key={ei} className="mb-4">
                            {/* Speaker — clickable */}
                            <p className={`text-center font-bold uppercase tracking-[0.2em] text-sm ${nameColor} mb-1 group cursor-pointer hover:bg-indigo-50 rounded`}
                              onClick={() => editable && startEdit({ type: 'dialogue', sceneIdx: si, elemIdx: ei, field: 'speaker' }, el.speaker)}>
                              {name}
                              <EditHint label="角色" />
                            </p>

                            {/* Emotion — clickable */}
                            <p className={`text-center text-xs mb-1 ${emotionColor} group cursor-pointer`}
                              onClick={() => editable && startEdit({ type: 'dialogue', sceneIdx: si, elemIdx: ei, field: 'emotion' }, el.emotion)}>
                              {el.emotion ? `（${el.emotion}）` : '（点击添加情绪）'}
                              <EditHint label="情绪" />
                            </p>

                            {/* Lines — clickable */}
                            <div className="max-w-[360px] mx-auto group cursor-pointer hover:bg-indigo-50 rounded"
                              onClick={() => editable && startEdit({ type: 'dialogue', sceneIdx: si, elemIdx: ei, field: 'lines' }, el.lines.join('\n'))}>
                              {el.lines.map((line, j) => (
                                <p key={j} className={`text-center ${dialogueColor} mb-0.5`}>{line}</p>
                              ))}
                              <EditHint label="台词" />
                            </div>

                            {/* Notes — clickable */}
                            <p className={`text-center text-xs mt-1 ${emotionColor} group cursor-pointer`}
                              onClick={() => editable && startEdit({ type: 'dialogue', sceneIdx: si, elemIdx: ei, field: 'notes' }, el.notes)}>
                              {el.notes ? `（${el.notes}）` : '（点击添加备注）'}
                              <EditHint label="备注" />
                            </p>
                          </div>
                        )
                      }
                      return null
                    })}

                    {si < script.scenes.length - 1 && (
                      <div className={`text-center mt-6 mb-2 text-xs tracking-[0.5em] ${sepColor}`}>
                        {SCENE_SEPARATOR}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* AI Chat Sidebar */}
        {chatOpen && (
          <div className="w-1/2 flex flex-col bg-gray-50 rounded-lg border border-gray-200 ml-2 max-h-[600px]">
            <div className="p-3 border-b border-gray-200 bg-white rounded-t-lg">
              <h4 className="text-sm font-semibold text-gray-700">💬 AI 协作修改</h4>
              <p className="text-xs text-gray-400 mt-0.5">输入修改指令，AI 会自动定位并修改剧本</p>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-3">
              {chatMessages.length === 0 && (
                <p className="text-xs text-gray-400 text-center mt-8">
                  试试说：<br />
                  "把陈平安的性格改得更阴沉一些"<br />
                  "第 3 场的对话缩短一点"<br />
                  "在结尾加一场告别戏"
                </p>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`text-sm p-2 rounded-lg ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-800 ml-8' : 'bg-white border border-gray-200 text-gray-700 mr-8'}`}>
                  <p className="text-xs text-gray-400 mb-1">{msg.role === 'user' ? '你' : '🤖 AI'}</p>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {msg.changes && msg.changes.length > 0 && (
                    <ul className="mt-2 text-xs text-green-700 space-y-0.5">
                      {msg.changes.map((c, j) => <li key={j}>• {c}</li>)}
                    </ul>
                  )}
                </div>
              ))}
              {chatLoading && <div className="text-sm text-gray-400 p-2 mr-8">🤖 AI 正在修改...</div>}
              {pendingScript && (
                <div className="flex gap-2 mt-2">
                  <button onClick={handleAccept} className="flex-1 px-3 py-2 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors">✅ 确认应用</button>
                  <button onClick={handleReject} className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-300 transition-colors">↩ 撤销</button>
                </div>
              )}
            </div>
            <div className="p-3 border-t border-gray-200 bg-white rounded-b-lg">
              <div className="flex gap-2">
                <textarea className="flex-1 p-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-indigo-500" rows={2} placeholder="输入修改指令...（Enter 发送）"
                  value={instruction} onChange={(e) => setInstruction(e.target.value)} onKeyDown={handleKeyDown} disabled={chatLoading} />
                <button onClick={handleSend} disabled={chatLoading || !instruction.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors self-end">
                  发送
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
