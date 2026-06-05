import { useState } from 'react'
import InputSection from './components/InputSection'
import ChapterList from './components/ChapterList'
import ProgressDisplay from './components/ProgressDisplay'
import ResultPanel from './components/ResultPanel'
import { submitConvert } from './api'
import type { ConvertResponse } from './types'

function App() {
  const [result, setResult] = useState<ConvertResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (text: string) => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await submitConvert(text)
      setResult(response)
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-700 mb-2">
            🎬 AI 小说转剧本工具
          </h1>
          <p className="text-gray-500">
            将小说文本自动转换为结构化 YAML 剧本格式
          </p>
        </header>

        <InputSection onSubmit={handleSubmit} disabled={loading} />

        {result?.chapters && result.chapters.length > 0 && (
          <ChapterList chapters={result.chapters} />
        )}

        {loading && (
          <ProgressDisplay
            progress={result?.progress || 0}
            chapters={result?.chapters || []}
          />
        )}

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            ❌ {error}
          </div>
        )}

        {result?.status === 'completed' && result.script && (
          <ResultPanel script={result.script} />
        )}
      </div>
    </div>
  )
}

export default App
