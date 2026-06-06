import { useState, useRef, useEffect } from 'react'
import Icon from './Icon'

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

  useEffect(() => { if (extFileName) setFileName(extFileName) }, [extFileName])

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

  const handleSubmit = () => { if (text.trim() && !disabled) onSubmit(text.trim()) }

  if (showCompact) {
    return (
      <div className="card-warm p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-sm">
          <div className="w-6 h-6 rounded-full bg-soft-amber flex items-center justify-center"><Icon name="check" size={12} className="text-warm-gray" /></div>
          <span className="text-warm-gray">{fileName ? `已加载：${fileName}` : '已粘贴文本'}</span>
        </div>
        <button onClick={() => fileRef.current?.click()} className="text-xs text-warm-gray-light hover:text-ink flex items-center gap-1 underline"><Icon name="upload" size={12} />更换</button>
        <input ref={fileRef} type="file" accept=".txt" onChange={handleFileUpload} className="hidden" disabled={disabled} />
      </div>
    )
  }

  return (
    <div className="card-warm p-6">
      <input ref={fileRef} type="file" accept=".txt" onChange={handleFileUpload} className="hidden" disabled={disabled} />

      {!fileName && !showPaste && (
        <button onClick={() => fileRef.current?.click()} disabled={disabled}
          className="w-full py-12 border-2 border-dashed border-border rounded-xl
                     text-sm text-warm-gray-light hover:text-ink hover:border-warm-gray-light
                     transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                     flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-soft-amber/60 flex items-center justify-center">
            <Icon name="upload" size={24} className="text-warm-gray" />
          </div>
          <div className="text-center">
            <p className="text-sm text-warm-gray font-medium">拖拽 .txt 文件到此处，或点击选择</p>
            <p className="text-[11px] text-warm-gray-light mt-1">支持：第 1 章 / 第一章 / Chapter 1</p>
          </div>
        </button>
      )}

      {fileName && !showPaste && (
        <div className="flex items-center justify-between p-4 bg-soft-amber/50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-soft-amber flex items-center justify-center">
              <Icon name="file" size={16} className="text-warm-gray" />
            </div>
            <div>
              <p className="text-sm text-ink font-medium">{fileName}</p>
              <p className="text-[11px] text-warm-gray-light">文件已加载，点击下方检测章节</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { setFileName(''); setText('') }} className="text-xs text-warm-gray-light hover:text-ink">换文件</button>
            <button onClick={() => setShowPaste(true)} className="text-xs text-warm-gray-light hover:text-ink">贴文本</button>
          </div>
        </div>
      )}

      {!fileName && (
        <button onClick={() => setShowPaste(!showPaste)}
          className="w-full text-center text-xs text-warm-gray-light hover:text-ink py-2 mt-1 transition-colors">
          {showPaste ? '收起' : '或直接粘贴文本'}
        </button>
      )}

      {(showPaste || (text && !fileName)) && (
        <div className="mt-2">
          <textarea
            className="w-full h-44 p-3 border border-border rounded-lg text-sm resize-y
                       focus:border-warm-gray-light focus:ring-0 outline-none placeholder:text-warm-gray-light"
            placeholder="粘贴小说文本..." value={text} onChange={(e) => setText(e.target.value)} disabled={disabled}
          />
          <div className="flex justify-end mt-2">
            <button onClick={handleSubmit} disabled={disabled || !text.trim()}
              className="btn-primary flex items-center gap-1.5">
              <Icon name="eye" size={14} />检测章节
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
