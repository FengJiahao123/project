import { useState, useMemo } from 'react'
import type { ChapterInfo } from '../types'

interface Props {
  chapters: ChapterInfo[]
  onSubmit: (selectedIndices: number[]) => void
  onCancel: () => void
}

const MAX_RECOMMENDED_CHARS = 35000

export default function ChapterSelector({ chapters, onSubmit, onCancel }: Props) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(chapters.map((c) => c.index)),
  )
  const [rangeInput, setRangeInput] = useState('')

  const toggle = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(chapters.map((c) => c.index)))
  const selectNone = () => setSelected(new Set())

  const applyRange = () => {
    const parts = rangeInput.split(/[,;，；]\s*/)
    const newSet = new Set(selected)
    for (const part of parts) {
      const rangeMatch = part.match(/^(\d+)\s*[-–—]\s*(\d+)$/)
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1]) - 1
        const end = parseInt(rangeMatch[2]) - 1
        for (let i = Math.max(0, start); i <= Math.min(end, chapters.length - 1); i++) {
          newSet.add(i)
        }
      } else {
        const num = parseInt(part) - 1
        if (num >= 0 && num < chapters.length) newSet.add(num)
      }
    }
    setSelected(newSet)
    setRangeInput('')
  }

  const selectedList = useMemo(() => {
    return [...selected].sort((a, b) => a - b)
  }, [selected])

  const totalChars = useMemo(() => {
    return selectedList.reduce((sum, idx) => sum + chapters[idx].length, 0)
  }, [selectedList, chapters])

  const overLimit = totalChars > MAX_RECOMMENDED_CHARS

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">
        📖 选择要转换的章节
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        检测到 {chapters.length} 个章节，请选择要转换的章节
      </p>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-gray-500">已选</span>
          <span className="font-bold text-indigo-600">{selectedList.length}</span>
          <span className="text-gray-500">章</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-gray-500">总字数</span>
          <span className={`font-bold ${overLimit ? 'text-red-600' : 'text-indigo-600'}`}>
            {totalChars.toLocaleString()}
          </span>
        </div>
        {overLimit && (
          <span className="text-xs text-red-500 font-medium bg-red-50 px-2 py-0.5 rounded">
            ⚠️ 建议不超过 {MAX_RECOMMENDED_CHARS.toLocaleString()} 字
          </span>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button onClick={selectAll} className="text-xs text-indigo-600 hover:text-indigo-800">
          全选
        </button>
        <button onClick={selectNone} className="text-xs text-gray-500 hover:text-gray-700">
          取消全选
        </button>
        <span className="text-gray-300">|</span>
        <input
          className="text-xs px-2 py-1 border border-gray-300 rounded w-28"
          placeholder="如 1-10, 15"
          value={rangeInput}
          onChange={(e) => setRangeInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') applyRange() }}
        />
        <button onClick={applyRange} className="text-xs text-indigo-600 hover:text-indigo-800">
          应用
        </button>
      </div>

      {/* Chapter list */}
      <div className="max-h-64 overflow-auto border border-gray-200 rounded-lg mb-4">
        {chapters.map((ch) => (
          <div
            key={ch.index}
            className={`flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 text-sm cursor-pointer hover:bg-indigo-50 transition-colors ${
              selected.has(ch.index) ? 'bg-indigo-50/50' : ''
            }`}
            onClick={() => toggle(ch.index)}
          >
            <input
              type="checkbox"
              checked={selected.has(ch.index)}
              onChange={() => {}}
              className="shrink-0"
            />
            <span className="flex-1 truncate">{ch.title}</span>
            <span className="text-xs text-gray-400 shrink-0">{ch.length.toLocaleString()} 字</span>
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div className="flex items-center justify-between">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          取消
        </button>
        <button
          onClick={() => onSubmit(selectedList)}
          disabled={selectedList.length === 0}
          className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {overLimit ? '⚠️ 开始转换（字数较多）' : '🔄 开始转换'}
        </button>
      </div>
    </div>
  )
}
