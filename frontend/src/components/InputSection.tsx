import { useState, useRef } from 'react'

interface Props {
  onSubmit: (text: string) => void
  disabled: boolean
}

export default function InputSection({ onSubmit, disabled }: Props) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      setText(reader.result as string)
    }
    reader.readAsText(file)
  }

  const handleSubmit = () => {
    if (text.trim() && !disabled) {
      onSubmit(text.trim())
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        第一步：输入小说文本
      </h2>

      <textarea
        className="w-full h-48 p-4 border border-gray-300 rounded-lg text-sm
                   focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                   resize-y placeholder-gray-400"
        placeholder={`在此粘贴小说文本（至少包含 3 个章节）...\n支持的章节格式：\n  · 第1章 / 第2章 ...\n  · 第一章 / 第二章 ...\n  · Chapter 1 / Chapter 2 ...`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
      />

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".txt"
            onChange={handleFileUpload}
            className="hidden"
            disabled={disabled}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={disabled}
            className="text-sm text-indigo-600 hover:text-indigo-800
                       disabled:text-gray-400 transition-colors"
          >
            📁 上传 .txt 文件
          </button>
          {fileName && (
            <span className="text-sm text-gray-500">{fileName}</span>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium
                     hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                     transition-colors"
        >
          🔄 开始转换
        </button>
      </div>
    </div>
  )
}
