import { useState, useRef, useCallback, useEffect } from 'react'
import InputSection from './components/InputSection'
import ChapterList from './components/ChapterList'
import ResultPanel from './components/ResultPanel'
import { submitConvert, getStatus } from './api'
import type { ConvertResponse } from './types'

const PHASE_CONFIG = [
  { max: 35, speed: 0.12, label: '📖 正在阅读理解全文...' },
  { max: 70, speed: 0.08, label: '🔍 正在分析角色与场景...' },
  { max: 90, speed: 0.04, label: '✍️ 正在生成剧本...' },
]

function App() {
  const [result, setResult] = useState<ConvertResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Smooth progress state
  const [displayProgress, setDisplayProgress] = useState(0)
  const [phaseLabel, setPhaseLabel] = useState('')
  const animTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const realDoneRef = useRef(false)

  const clearAnim = useCallback(() => {
    if (animTimerRef.current) {
      clearInterval(animTimerRef.current)
      animTimerRef.current = null
    }
  }, [])

  const startAnimation = useCallback(() => {
    clearAnim()
    realDoneRef.current = false
    setDisplayProgress(0)

    animTimerRef.current = setInterval(() => {
      setDisplayProgress(prev => {
        if (realDoneRef.current) {
          // Fast-forward to 100 when real completion arrives
          const next = prev + 2
          if (next >= 100) {
            clearAnim()
            return 100
          }
          return next
        }

        // Pick current phase
        let phase = PHASE_CONFIG[0]
        for (const p of PHASE_CONFIG) {
          if (prev < p.max) { phase = p; break }
        }
        // If past all phases, stay at last phase max
        if (prev >= PHASE_CONFIG[PHASE_CONFIG.length - 1].max) {
          phase = PHASE_CONFIG[PHASE_CONFIG.length - 1]
        }

        setPhaseLabel(phase.label)
        const next = prev + phase.speed
        return Math.min(next, phase.max)
      })
    }, 50)
  }, [clearAnim])

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
          realDoneRef.current = true
          // Give animation 2s to fast-forward to 100, then show result
          setTimeout(() => {
            clearAnim()
            setDisplayProgress(100)
            setPhaseLabel('✅ 转换完成')
            setLoading(false)
          }, 2000)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Polling failed')
        stopPolling()
        clearAnim()
        setLoading(false)
      }
    }, 800)
  }, [stopPolling, clearAnim])

  const handleSubmit = async (text: string) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setDisplayProgress(0)
    setPhaseLabel('')
    clearAnim()

    try {
      const initial = await submitConvert(text)
      setResult(initial)

      // Start smooth animation immediately
      setPhaseLabel('📖 正在阅读理解全文...')
      startAnimation()

      if (initial.task_id) {
        startPolling(initial.task_id)
      } else {
        setLoading(false)
        clearAnim()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
      setLoading(false)
      clearAnim()
    }
  }

  useEffect(() => {
    return () => { stopPolling(); clearAnim() }
  }, [stopPolling, clearAnim])

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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">
                {phaseLabel || '🔄 准备中...'}
              </h3>
              <span className="text-sm font-mono text-indigo-600">
                {Math.round(displayProgress)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-linear"
                style={{ width: `${displayProgress}%` }}
              />
            </div>
          </div>
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
