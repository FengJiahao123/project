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
      const fileText = reader.result as string
      setText(fileText)
      // Automatically submit the file content for chapter detection
      if (fileText.trim() && !disabled) {
        onSubmit(fileText.trim())
      }
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
        第一步：选择小说
      </h2>

      {/* File upload — primary action */}
      <div className="flex items-center gap-3 mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
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
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium
                     hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                     transition-colors"
        >
          📁 上传 .txt 小说文件
        </button>
        <span className="text-xs text-gray-500">
          上传后自动识别章节
        </span>
        {fileName && (
          <span className="text-sm text-indigo-700 font-medium">{fileName}</span>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 border-t border-gray-200" />
        <span className="text-xs text-gray-400">或者粘贴文本</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      <textarea
        className="w-full h-32 p-4 border border-gray-300 rounded-lg text-sm
                   focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                   resize-y placeholder-gray-400"
        placeholder={`在此粘贴小说文本...\n支持格式：第1章 / 第一章 / Chapter 1`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
      />

      <div className="flex justify-end mt-3">
        <button
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium
                     hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                     transition-colors"
        >
          🔍 检测章节
        </button>
      </div>
    </div>
  )
}
