import { useState, useMemo } from 'react'
import type { ChapterInfo } from '../types'

interface Props {
  chapters: ChapterInfo[]
  onSubmit: (selectedIndices: number[]) => void
  onCancel: () => void
}

const MAX_RECOMMENDED = 35000

export default function ChapterSelector({ chapters, onSubmit, onCancel }: Props) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(chapters.map((c) => c.index)),
  )
  const [rangeInput, setRangeInput] = useState('')

  const toggle = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) { next.delete(idx) } else { next.add(idx) }
      return next
    })
  }

  const selectAll = () => setSelected(new Set(chapters.map((c) => c.index)))
  const selectNone = () => setSelected(new Set())

  const applyRange = () => {
    const parts = rangeInput.split(/[,;，；]\s*/)
    const newSet = new Set(selected)
    for (const part of parts) {
      const m = part.match(/^(\d+)\s*[-–—]\s*(\d+)$/)
      if (m) {
        for (let i = Math.max(0, +m[1] - 1); i <= Math.min(+m[2] - 1, chapters.length - 1); i++) newSet.add(i)
      } else {
        const n = +part - 1
        if (n >= 0 && n < chapters.length) newSet.add(n)
      }
    }
    setSelected(newSet)
    setRangeInput('')
  }

  const selectedList = useMemo(() => [...selected].sort((a, b) => a - b), [selected])
  const totalChars = useMemo(() => selectedList.reduce((s, i) => s + chapters[i].length, 0), [selectedList, chapters])
  const overLimit = totalChars > MAX_RECOMMENDED

  return (
    <div className="card-warm p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-serif text-lg font-bold text-ink">选择章节</h2>
          <p className="text-xs text-warm-gray mt-0.5">
            已选 {selectedList.length} 章 · 共 {totalChars.toLocaleString()} 字
            {overLimit && <span className="text-merlot ml-2">建议 ≤ {MAX_RECOMMENDED.toLocaleString()} 字</span>}
          </p>
        </div>
        <button onClick={onCancel} className="text-xs text-warm-gray-light hover:text-ink transition-colors">取消</button>
      </div>

      {/* Quick tools */}
      <div className="flex items-center gap-3 mb-3 flex-wrap text-xs">
        <button onClick={selectAll} className="text-ink/70 hover:text-ink">全选</button>
        <button onClick={selectNone} className="text-warm-gray-light hover:text-ink">取消全选</button>
        <span className="text-border">|</span>
        <input
          className="px-2 py-1 border border-border rounded text-xs w-24 outline-none focus:border-warm-gray-light"
          placeholder="如 1-5, 8"
          value={rangeInput}
          onChange={(e) => setRangeInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') applyRange() }}
        />
        <button onClick={applyRange} className="text-ink/70 hover:text-ink">应用</button>
      </div>

      {/* Chapter list */}
      <div className="max-h-60 overflow-auto border border-border rounded-lg mb-4 divide-y divide-border-light">
        {chapters.map((ch) => (
          <div
            key={ch.index}
            className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer transition-colors ${
              selected.has(ch.index) ? 'bg-soft-amber/60' : 'hover:bg-soft-amber/30'
            }`}
            onClick={() => toggle(ch.index)}
          >
            <input type="checkbox" checked={selected.has(ch.index)} onChange={() => {}} className="accent-ink" />
            <span className="flex-1 truncate">{ch.title}</span>
            <span className="text-xs text-warm-gray-light shrink-0">{ch.length.toLocaleString()} 字</span>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => onSubmit(selectedList)}
          disabled={selectedList.length === 0}
          className="px-6 py-2 bg-ink text-white rounded-lg text-sm font-medium
                     hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          {overLimit ? `开始转化（${totalChars.toLocaleString()} 字）` : '开始转化'}
        </button>
      </div>
    </div>
  )
}
