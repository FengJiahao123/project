import { useState, useCallback, useRef } from 'react'
import type { Script } from '../types'

interface Props {
  script: Script
}

const SCENE_SEPARATOR = '─'.repeat(60)

export default function ScriptPreview({ script }: Props) {
  const [darkMode, setDarkMode] = useState(false)
  const [copied, setCopied] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  // Build plain text version for copy/download
  const buildTextScript = useCallback(() => {
    const lines: string[] = []
    const charMap = new Map(script.characters.map((c) => [c.id, c.name]))

    lines.push(script.meta.title || '剧本')
    lines.push('')
    lines.push('='.repeat(60))
    lines.push('')

    for (const scene of script.scenes) {
      const loc = scene.location
      lines.push(
        `SCENE ${scene.scene_number} — ${loc.name} — ${loc.time}`,
      )
      if (loc.description) lines.push(`  ${loc.description}`)
      lines.push('')

      for (const el of scene.elements) {
        if (el.type === 'action') {
          lines.push(el.content)
          lines.push('')
        } else if (el.type === 'dialogue') {
          const name = charMap.get(el.speaker) || el.speaker
          lines.push(`                    ${name}`)
          lines.push('')
          for (const line of el.lines) {
            lines.push(`          ${line}`)
          }
          if (el.emotion) {
            lines.push(`                    （${el.emotion}）`)
          }
          lines.push('')
        } else if (el.type === 'transition') {
          lines.push(`                                          ${el.content}`)
          lines.push('')
        }
      }

      lines.push(SCENE_SEPARATOR)
      lines.push('')
    }

    return lines.join('\n')
  }, [script])

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
  pre { white-space: pre-wrap; font-family: inherit; font-size: inherit; line-height: inherit; }
</style></head><body><pre>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
<script>window.onload=function(){window.print();window.close()}<\/script></body></html>`)
    w.document.close()
  }

  const charMap = new Map(script.characters.map((c) => [c.id, c.name]))

  const bg = darkMode ? 'bg-gray-900' : 'bg-white'
  const textColor = darkMode ? 'text-gray-100' : 'text-gray-900'
  const sceneColor = darkMode ? 'text-yellow-400' : 'text-gray-800'
  const actionColor = darkMode ? 'text-gray-200' : 'text-gray-800'
  const nameColor = darkMode ? 'text-blue-400' : 'text-gray-900'
  const dialogueColor = darkMode ? 'text-gray-100' : 'text-gray-800'
  const emotionColor = darkMode ? 'text-gray-400' : 'text-gray-500'
  const transitionColor = darkMode ? 'text-gray-400' : 'text-gray-500'
  const sepColor = darkMode ? 'text-gray-600' : 'text-gray-300'

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-600 dark:text-gray-300">
          📜 剧本预览
        </h4>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              darkMode
                ? 'bg-gray-700 text-yellow-400 border-gray-600'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {darkMode ? '☀️ 亮色' : '🌙 暗色'}
          </button>
          <button
            onClick={handlePrint}
            className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            📥 打印 / PDF
          </button>
          <button
            onClick={handleCopy}
            className="text-xs px-3 py-1.5 bg-white text-gray-600 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            {copied ? '✅ 已复制' : '📋 复制文本'}
          </button>
        </div>
      </div>

      {/* Script Content */}
      <div
        ref={printRef}
        className={`${bg} rounded-lg border border-gray-200 overflow-auto max-h-[600px]`}
        style={{ fontFamily: '"Courier New", Courier, "Noto Sans SC", monospace' }}
      >
        <div className="p-8 max-w-[680px] mx-auto" style={{ fontSize: '14px', lineHeight: '1.9' }}>
          {/* Title */}
          <div className="text-center mb-8">
            <h2 className={`text-xl font-bold ${textColor} tracking-wider`}>
              {script.meta.title || '剧本'}
            </h2>
            {script.meta.original_work && (
              <p className={`text-xs mt-1 ${emotionColor}`}>
                原著：《{script.meta.original_work}》{script.meta.original_author !== '未知' ? `　作者：${script.meta.original_author}` : ''}
              </p>
            )}
          </div>

          {/* Scenes */}
          {script.scenes.map((scene) => {
            const loc = scene.location
            return (
              <div key={scene.scene_number} className="mb-8">
                {/* Scene Header */}
                <div className="text-center mb-5">
                  <h3
                    className={`text-sm font-bold tracking-[0.3em] uppercase ${sceneColor}`}
                  >
                    SCENE {scene.scene_number}
                  </h3>
                  <p className={`text-xs mt-1 ${emotionColor}`}>
                    {loc.name}　—　{loc.time}
                  </p>
                  {loc.description && (
                    <p className={`text-xs italic ${emotionColor} mt-0.5 max-w-sm mx-auto`}>
                      {loc.description}
                    </p>
                  )}
                </div>

                {/* Elements */}
                {scene.elements.map((el, i) => {
                  if (el.type === 'action') {
                    return (
                      <p key={i} className={`mb-3 ${actionColor} text-justify`}>
                        {el.content}
                      </p>
                    )
                  }

                  if (el.type === 'transition') {
                    return (
                      <p key={i} className={`mb-4 text-right text-sm ${transitionColor}`}>
                        {el.content}
                      </p>
                    )
                  }

                  if (el.type === 'dialogue') {
                    const name = charMap.get(el.speaker) || el.speaker
                    return (
                      <div key={i} className="mb-4">
                        {/* Character Name */}
                        <p className={`text-center font-bold uppercase tracking-[0.2em] text-sm ${nameColor} mb-1`}>
                          {name}
                        </p>

                        {/* Emotion */}
                        {el.emotion && (
                          <p className={`text-center text-xs mb-1 ${emotionColor}`}>
                            （{el.emotion}）
                          </p>
                        )}

                        {/* Lines */}
                        <div className="max-w-[360px] mx-auto">
                          {el.lines.map((line, j) => (
                            <p key={j} className={`text-center ${dialogueColor} mb-0.5`}>
                              {line}
                            </p>
                          ))}
                        </div>

                        {/* Notes */}
                        {el.notes && (
                          <p className={`text-center text-xs mt-1 ${emotionColor}`}>
                            （{el.notes}）
                          </p>
                        )}
                      </div>
                    )
                  }

                  return null
                })}

                {/* Scene Separator */}
                {scene.scene_number < script.scenes.length && (
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
  )
}
