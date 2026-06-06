import { useState, useRef, useCallback, useEffect } from 'react'
import InputSection from './components/InputSection'
import OutlinePreview from './components/OutlinePreview'
import ResultPanel from './components/ResultPanel'
import { submitConvert, getStatus, analyzeOutline } from './api'
import type { ConvertResponse, OutlineResponse } from './types'

const PHASE_CONFIG = [
  { max: 35, speed: 0.12, label: '📖 正在阅读理解全文...' },
  { max: 70, speed: 0.08, label: '🔍 正在分析角色与场景...' },
  { max: 90, speed: 0.04, label: '✍️ 正在生成剧本...' },
]

function App() {
  // ====== Stage: input | outline | generating | done ======
  const [stage, setStage] = useState<'input' | 'outline' | 'generating' | 'done'>('input')
  const [result, setResult] = useState<ConvertResponse | null>(null)
  const [outline, setOutline] = useState<OutlineResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Outline loading
  const [outlineLoading, setOutlineLoading] = useState(false)

  // Smooth progress
  const [displayProgress, setDisplayProgress] = useState(0)
  const [phaseLabel, setPhaseLabel] = useState('')
  const animTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const realDoneRef = useRef(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearAnim = useCallback(() => {
    if (animTimerRef.current) { clearInterval(animTimerRef.current); animTimerRef.current = null }
  }, [])

  const startAnimation = useCallback(() => {
    clearAnim()
    realDoneRef.current = false
    setDisplayProgress(0)
    setPhaseLabel('📖 正在阅读理解全文...')
    animTimerRef.current = setInterval(() => {
      setDisplayProgress((prev) => {
        if (realDoneRef.current) {
          const n = prev + 2
          if (n >= 100) { clearAnim(); return 100 }
          return n
        }
        let phase = PHASE_CONFIG[0]
        for (const p of PHASE_CONFIG) { if (prev < p.max) { phase = p; break } }
        if (prev >= PHASE_CONFIG[PHASE_CONFIG.length - 1].max) phase = PHASE_CONFIG[PHASE_CONFIG.length - 1]
        setPhaseLabel(phase.label)
        const next = prev + phase.speed
        return Math.min(next, phase.max)
      })
    }, 50)
  }, [clearAnim])

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
  }, [])

  // ====== Submit text → analyze outline ======
  const handleSubmit = async (text: string) => {
    setError(null)
    setResult(null)
    setOutline(null)
    setOutlineLoading(true)
    setStage('outline')

    try {
      const o = await analyzeOutline(text)
      setOutline(o)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Outline analysis failed')
      setStage('input')
    } finally {
      setOutlineLoading(false)
    }
  }

  // ====== Need original text for conversion — store it ======
  const [pendingText, setPendingText] = useState('')

  const handleSubmitWrapper = async (text: string) => {
    setPendingText(text)
    await handleSubmit(text)
  }

  const handleConfirmOutlineWrapper = async () => {
    if (!pendingText) return
    setStage('generating')
    setDisplayProgress(0)
    setPhaseLabel('📖 正在阅读理解全文...')
    startAnimation()

    try {
      const initial = await submitConvert(pendingText)
      setResult(initial)
      if (initial.task_id) {
        startPolling(initial.task_id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
      setStage('outline')
      clearAnim()
    }
  }

  const startPollingFn = useCallback(
    (taskId: string) => {
      stopPolling()
      pollingRef.current = setInterval(async () => {
        try {
          const status = await getStatus(taskId)
          setResult(status)
          if (status.status === 'completed' || status.status === 'error') {
            stopPolling()
            realDoneRef.current = true
            setTimeout(() => {
              clearAnim()
              setDisplayProgress(100)
              setPhaseLabel('✅ 转换完成')
              setStage('done')
            }, 2000)
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Polling failed')
          stopPolling()
          clearAnim()
          setStage('outline')
        }
      }, 800)
    },
    [stopPolling, clearAnim],
  )

  const startPolling = useCallback(
    (taskId: string) => startPollingFn(taskId),
    [startPollingFn],
  )

  useEffect(() => {
    return () => { stopPolling(); clearAnim() }
  }, [stopPolling, clearAnim])

  // ====== Render ======
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

        {/* Input — always visible until done */}
        <InputSection onSubmit={handleSubmitWrapper} disabled={stage === 'generating' || stage === 'done'} />

        {/* Outline loading */}
        {outlineLoading && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl animate-spin mb-3">🔍</div>
            <p className="text-gray-600 font-medium">正在分析小说结构...</p>
            <p className="text-xs text-gray-400 mt-1">识别场景边界、角色出场顺序、改编建议</p>
          </div>
        )}

        {/* Outline result */}
        {outline && stage === 'outline' && (
          <OutlinePreview
            outline={outline}
            onConfirm={handleConfirmOutlineWrapper}
            onRetry={() => handleSubmit(pendingText)}
            loading={false}
          />
        )}

        {/* Generating — smooth progress */}
        {stage === 'generating' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">{phaseLabel || '🔄 准备中...'}</h3>
              <span className="text-sm font-mono text-indigo-600">{Math.round(displayProgress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-linear"
                style={{ width: `${displayProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            ❌ {error}
          </div>
        )}

        {/* Result */}
        {stage === 'done' && result?.script && (
          <ResultPanel script={result.script} />
        )}
      </div>
    </div>
  )
}

export default App
