import { useState, useRef } from 'react'

interface Props {
  onSubmit: (text: string) => void
  disabled: boolean
}

export default function InputSection({ onSubmit, disabled }: Props) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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

  return (
    <div className="card-warm p-6">
      {/* File upload area */}
      <input ref={fileRef} type="file" accept=".txt" onChange={handleFileUpload} className="hidden" disabled={disabled} />

      {!fileName && !showPaste && (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="w-full py-10 border-2 border-dashed border-border rounded-xl
                     text-sm text-warm-gray-light hover:text-ink hover:border-warm-gray-light
                     transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                     flex flex-col items-center gap-2"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-warm-gray-light">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span className="text-xs text-warm-gray">
            拖拽 .txt 文件到这里，或点击选择文件
          </span>
        </button>
      )}

      {fileName && (
        <div className="flex items-center justify-between p-4 bg-soft-amber rounded-lg">
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-warm-gray">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="text-sm text-ink font-medium">{fileName}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setFileName(''); setText('') }}
              className="text-xs text-warm-gray-light hover:text-ink">换文件</button>
            <button onClick={() => setShowPaste(true)}
              className="text-xs text-warm-gray-light hover:text-ink">或粘贴文本</button>
          </div>
        </div>
      )}

      {/* Divider + paste toggle */}
      {!fileName && (
        <button
          onClick={() => setShowPaste(!showPaste)}
          className="w-full text-center text-xs text-warm-gray-light hover:text-ink py-1 mt-2 transition-colors"
        >
          {showPaste ? '收起' : '或者粘贴文本'}
        </button>
      )}

      {/* Paste area */}
      {(showPaste || (text && !fileName)) && (
        <div className="mt-3">
          <textarea
            className="w-full h-40 p-3 border border-border rounded-lg text-sm resize-y
                       focus:border-warm-gray-light focus:ring-0 outline-none
                       placeholder:text-warm-gray-light"
            placeholder="在此粘贴小说文本... 支持：第1章 / 第一章 / Chapter 1"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={disabled}
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={handleSubmit}
              disabled={disabled || !text.trim()}
              className="px-5 py-2 bg-ink text-white rounded-lg text-sm font-medium
                         hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              检测章节
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
