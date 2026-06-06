import { useState, useRef, useCallback } from 'react'
import InputSection from './components/InputSection'
import ChapterList from './components/ChapterList'
import ProgressDisplay from './components/ProgressDisplay'
import ResultPanel from './components/ResultPanel'
import { submitConvert, getStatus } from './api'
import type { ConvertResponse } from './types'

function App() {
  const [result, setResult] = useState<ConvertResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const startPolling = useCallback((taskId: string) => {
    stopPolling()
    pollingRef.current = setInterval(async () => {
      try {
        const status = await getStatus(taskId)
        setResult(status)

        if (status.status === 'completed' || status.status === 'error') {
          stopPolling()
          setLoading(false)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '获取进度失败')
        stopPolling()
        setLoading(false)
      }
    }, 500)
  }, [stopPolling])

  const handleSubmit = async (text: string) => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const initial = await submitConvert(text)
      // 立即显示初始状态（章节列表 + 0% 进度）
      setResult(initial)

      if (initial.task_id) {
        startPolling(initial.task_id)
      } else {
        // 降级：没有 task_id，可能直接完成了
        setLoading(false)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误')
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

        {!loading && result?.status === 'completed' && result.script && (
          <ResultPanel script={result.script} />
        )}
      </div>
    </div>
  )
}

export default App
