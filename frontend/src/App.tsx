import { useState } from 'react'
import InputSection from './components/InputSection'
import ChapterList from './components/ChapterList'
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
          <div className="mt-6 text-center">
            <div className="inline-block text-2xl animate-spin">⏳</div>
            <p className="text-gray-500 mt-2">正在转换中...</p>
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            ❌ {error}
          </div>
        )}

        {result?.status === 'completed' && result.script && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              转换完成 ✅
            </h2>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-auto max-h-96">
              {JSON.stringify(result.script, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
