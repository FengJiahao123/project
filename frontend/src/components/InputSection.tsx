import { useState, useRef, useEffect } from 'react'

interface Props {
  onSubmit: (text: string) => void
  disabled: boolean
  showCompact?: boolean
  fileName?: string
}

export default function InputSection({ onSubmit, disabled, showCompact, fileName: extFileName }: Props) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState(extFileName || '')
  const [showPaste, setShowPaste] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (extFileName) setFileName(extFileName)
  }, [extFileName])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const fileText = reader.result as string
      setText(fileText)
      if (fileText.trim() && !disabled) onSubmit(fileText.trim())
    }
    reader.readAsText(file)
  }

  const handleSubmit = () => {
    if (text.trim() && !disabled) onSubmit(text.trim())
  }

  if (showCompact) {
    return (
      <div className="card-warm p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <span className="w-6 h-6 rounded-full bg-soft-amber flex items-center justify-center text-xs text-warm-gray">1</span>
          <span className="text-warm-gray">
            {fileName ? `已加载：${fileName}` : '已粘贴文本'}
          </span>
        </div>
        <button onClick={() => fileRef.current?.click()} className="text-xs text-warm-gray-light hover:text-ink underline">
          更换文件
        </button>
        <input ref={fileRef} type="file" accept=".txt" onChange={handleFileUpload} className="hidden" disabled={disabled} />
      </div>
    )
  }

  return (
    <div className="card-warm p-6">
      <input ref={fileRef} type="file" accept=".txt" onChange={handleFileUpload} className="hidden" disabled={disabled} />

      {!fileName && !showPaste && (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="w-full py-12 border-2 border-dashed border-border rounded-xl
                     text-sm text-warm-gray-light hover:text-ink hover:border-warm-gray-light
                     transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                     flex flex-col items-center gap-3"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-warm-gray-light/60">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <div className="text-center">
            <p className="text-xs text-warm-gray font-medium">拖拽 .txt 文件到此处，或点击选择</p>
            <p className="text-[11px] text-warm-gray-light mt-1">支持格式：第 1 章 / 第一章 / Chapter 1</p>
          </div>
        </button>
      )}

      {fileName && !showPaste && (
        <div className="flex items-center justify-between p-4 bg-soft-amber/50 rounded-lg">
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-warm-gray">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="text-sm text-ink font-medium">{fileName}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { setFileName(''); setText('') }} className="text-xs text-warm-gray-light hover:text-ink">换文件</button>
            <button onClick={() => setShowPaste(true)} className="text-xs text-warm-gray-light hover:text-ink">粘贴文本</button>
          </div>
        </div>
      )}

      {!fileName && (
        <button onClick={() => setShowPaste(!showPaste)}
          className="w-full text-center text-xs text-warm-gray-light hover:text-ink py-1 mt-1 transition-colors">
          {showPaste ? '收起' : '或直接粘贴文本'}
        </button>
      )}

      {(showPaste || (text && !fileName)) && (
        <div className="mt-2">
          <textarea
            className="w-full h-40 p-3 border border-border rounded-lg text-sm resize-y
                       focus:border-warm-gray-light focus:ring-0 outline-none placeholder:text-warm-gray-light"
            placeholder="粘贴小说文本..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={disabled}
          />
          <div className="flex justify-end mt-2">
            <button onClick={handleSubmit} disabled={disabled || !text.trim()}
              className="px-5 py-2 bg-ink text-white rounded-lg text-sm font-medium
                         hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              检测章节
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
