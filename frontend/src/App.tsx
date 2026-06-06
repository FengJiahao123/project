import { useState, useRef, useCallback, useEffect } from 'react'
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

  // ===== 丝滑进度 =====
  const [smoothProgress, setSmoothProgress] = useState(0)
  const smoothTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timingRef = useRef({
    totalChapters: 0,
    startTime: 0,
    firstChapterDone: false,
  })

  const clearSmoothTimer = useCallback(() => {
    if (smoothTimerRef.current) {
      clearInterval(smoothTimerRef.current)
      smoothTimerRef.current = null
    }
  }, [])

  /** 启动丝滑进度动画：根据第一轮 LLM 耗时预测总时长，平滑递增 */
  const startSmoothProgress = useCallback((backendProgress: number, totalChapters: number) => {
    clearSmoothTimer()

    const now = Date.now()
    const elapsed = now - timingRef.current.startTime

    if (!timingRef.current.firstChapterDone && backendProgress > 0 && backendProgress < 100) {
      timingRef.current.firstChapterDone = true
      // 第一轮完成 —— 推算总时间
      const progressPerChapter = 100 / totalChapters
      const chaptersDone = Math.floor(backendProgress / progressPerChapter)
      const timePerChapter = chaptersDone > 0 ? elapsed / chaptersDone : elapsed
      const estimatedTotal = timePerChapter * totalChapters
      const remaining = Math.max(0, estimatedTotal - elapsed)

      const startPct = backendProgress
      const startTime = now

      smoothTimerRef.current = setInterval(() => {
        const dt = (Date.now() - startTime) / 1000
        const fraction = Math.min(1, dt / (remaining / 1000 + 0.001))
        const displayed = startPct + (100 - startPct) * fraction
        setSmoothProgress(Math.min(100, Math.floor(displayed * 10) / 10))
      }, 60)
    }
  }, [clearSmoothTimer])

  // 当 real progress === 100，强制丝滑条到 100
  useEffect(() => {
    if (result?.progress === 100) {
      clearSmoothTimer()
      setSmoothProgress(100)
    }
  }, [result?.progress, clearSmoothTimer])
  // ===== / 丝滑进度 =====

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const startPolling = useCallback((taskId: string, totalChapters: number) => {
    stopPolling()
    pollingRef.current = setInterval(async () => {
      try {
        const status = await getStatus(taskId)
        setResult(status)

        // 每次后端进度更新，触发丝滑动画重算
        if (status.progress > 0 && status.progress < 100) {
          startSmoothProgress(status.progress, totalChapters)
        }

        if (status.status === 'completed' || status.status === 'error') {
          stopPolling()
          clearSmoothTimer()
          setLoading(false)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '获取进度失败')
        stopPolling()
        clearSmoothTimer()
        setLoading(false)
      }
    }, 500)
  }, [stopPolling, startSmoothProgress, clearSmoothTimer])

  const handleSubmit = async (text: string) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setSmoothProgress(0)
    clearSmoothTimer()

    try {
      const initial = await submitConvert(text)

      timingRef.current = {
        totalChapters: initial.chapters.length,
        startTime: Date.now(),
        firstChapterDone: false,
      }

      setResult(initial)

      if (initial.task_id) {
        startPolling(initial.task_id, initial.chapters.length)
      } else {
        setLoading(false)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误')
      setLoading(false)
    }
  }

  // 页面卸载时清理
  useEffect(() => {
    return () => {
      stopPolling()
      clearSmoothTimer()
    }
  }, [stopPolling, clearSmoothTimer])

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
            progress={smoothProgress}
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
