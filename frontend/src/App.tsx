import { useState, useRef, useCallback, useEffect } from 'react'
import InputSection from './components/InputSection'
import ChapterSelector from './components/ChapterSelector'
import ResultPanel from './components/ResultPanel'
import AuthPage from './components/AuthPage'
import ProjectList from './components/ProjectList'
import { submitConvert, getStatus, detectChapters, setApiKey, checkConfig, apiCreateProject, apiGetProject, apiSaveProject, apiListProjects } from './api'
import type { ConvertResponse, ChapterInfo } from './types'

const PHASE_CONFIG = [
  { max: 35, speed: 0.12, label: '📖 正在阅读理解全文...' },
  { max: 70, speed: 0.08, label: '🔍 正在分析角色与场景...' },
  { max: 90, speed: 0.04, label: '✍️ 正在生成剧本...' },
]

function App() {
  // ====== Auth ======
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [username, setUsername] = useState(localStorage.getItem('username') || '')
  const [view, setView] = useState<'projects' | 'editor'>('projects')
  const [projectId, setProjectId] = useState<number | null>(null)
  const [projectName, setProjectName] = useState('')
  const [authChecked, setAuthChecked] = useState(false)

  // Validate token on mount
  useEffect(() => {
    if (token) {
      apiListProjects()
        .then(() => setAuthChecked(true))
        .catch(() => { localStorage.removeItem('token'); localStorage.removeItem('username'); setToken(null); setAuthChecked(true) })
    } else {
      setAuthChecked(true)
    }
  }, [])

  const handleLogin = (t: string, name: string) => {
    setToken(t); setUsername(name); setAuthChecked(true); setView('projects')
  }
  const handleLogout = () => {
    localStorage.removeItem('token'); localStorage.removeItem('username')
    setToken(null); setUsername('')
  }

  const handleNewProject = async () => {
    const name = prompt('项目名称：') || '未命名项目'
    const result = await apiCreateProject(name)
    if (result.ok) {
      setProjectId(result.project_id); setProjectName(name); setView('editor')
    }
  }

  const handleOpenProject = async (id: number, name: string) => {
    const proj = await apiGetProject(id)
    setProjectId(id); setProjectName(name)
    if (proj.original_text) setFullText(proj.original_text)
    setView('editor')
  }

  // ====== App State ======
  const [stage, setStage] = useState<'input' | 'chapterSelect' | 'generating' | 'done'>('input')
  const [result, setResult] = useState<ConvertResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Save script after each generation completes
  useEffect(() => {
    if (result?.status === 'completed' && result.script && projectId) {
      apiSaveProject(projectId, fullText, JSON.stringify(result.script)).catch(() => {})
    }
  }, [result?.status])

  // API Key
  const [apiKey, setApiKeyState] = useState('')
  const [apiKeySet, setApiKeySet] = useState(false)
  const [showKeyInput, setShowKeyInput] = useState(false)

  useEffect(() => {
    checkConfig().then((c) => setApiKeySet(c.api_key_set)).catch(() => {})
  }, [])

  const handleSetKey = async () => {
    if (!apiKey.trim()) return
    try {
      await setApiKey(apiKey.trim())
      setApiKeySet(true)
      setShowKeyInput(false)
      setApiKeyState('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '设置 API Key 失败')
    }
  }

  // Chapter detection
  const [fullText, setFullText] = useState('')
  const [chapters, setChapters] = useState<ChapterInfo[]>([])
  const [detectLoading, setDetectLoading] = useState(false)

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

  // ====== Submit text → detect chapters ======
  const handleDetect = async (text: string) => {
    setError(null)
    setResult(null)
    setFullText(text)
    setDetectLoading(true)

    try {
      const resp = await detectChapters(text)
      setChapters(resp.chapters)
      setStage('chapterSelect')
    } catch (e) {
      setError(e instanceof Error ? e.message : '章节检测失败')
    } finally {
      setDetectLoading(false)
    }
  }

  // ====== Select chapters → convert ======
  const handleStartConvert = async (selectedIndices: number[]) => {
    setStage('generating')
    setDisplayProgress(0)
    setPhaseLabel('📖 正在阅读理解全文...')
    startAnimation()

    try {
      const initial = await submitConvert(fullText, undefined, selectedIndices)
      setResult(initial)
      if (initial.task_id) {
        startPolling(initial.task_id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '转换请求失败')
      setStage('chapterSelect')
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
          setError(e instanceof Error ? e.message : '轮询失败')
          stopPolling()
          clearAnim()
          setStage('chapterSelect')
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

  // ====== Auth gate ======
  if (!authChecked) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400">加载中...</p></div>
  if (!token) return <AuthPage onLogin={handleLogin} />
  if (view === 'projects') {
    return <ProjectList onOpen={handleOpenProject} onNew={handleNewProject} onLogout={handleLogout} username={username} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-700 mb-2">
            🎬 AI 小说转剧本工具
          </h1>
          <p className="text-gray-500">
            {projectName} | <button onClick={() => setView('projects')} className="text-indigo-600 hover:text-indigo-800">返回项目列表</button>
          </p>
        </header>

        {/* API Key */}
        <div className="mb-4 flex items-center justify-center">
          {apiKeySet ? (
            <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
              ✅ API Key 已设置
              <button
                onClick={() => setShowKeyInput(true)}
                className="text-gray-400 hover:text-gray-600 ml-1"
              >（更换）</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg">
              <span className="text-xs text-amber-700 font-medium">⚠️ 请设置 DeepSeek API Key：</span>
              <input
                className="text-xs px-2 py-1 border border-gray-300 rounded w-64 font-mono"
                type="password" placeholder="sk-..." value={apiKey}
                onChange={(e) => setApiKeyState(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSetKey() }}
              />
              <button onClick={handleSetKey} disabled={!apiKey.trim()}
                className="text-xs px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:bg-gray-300 transition-colors">保存</button>
            </div>
          )}
          {showKeyInput && apiKeySet && (
            <div className="flex items-center gap-2 ml-2">
              <input
                className="text-xs px-2 py-1 border border-gray-300 rounded w-48 font-mono" type="password"
                placeholder="输入新 Key..." value={apiKey}
                onChange={(e) => setApiKeyState(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSetKey() }}
              />
              <button onClick={handleSetKey} disabled={!apiKey.trim()}
                className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-300">确认</button>
              <button onClick={() => setShowKeyInput(false)}
                className="text-xs text-gray-400 hover:text-gray-600">取消</button>
            </div>
          )}
        </div>

        <InputSection onSubmit={handleDetect} disabled={stage === 'generating' || detectLoading} />

        {detectLoading && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl animate-spin mb-3">🔍</div>
            <p className="text-gray-600 font-medium">正在检测章节...</p>
          </div>
        )}

        {stage === 'chapterSelect' && chapters.length > 0 && (
          <ChapterSelector
            chapters={chapters} onSubmit={handleStartConvert}
            onCancel={() => { setStage('input'); setChapters([]) }}
          />
        )}

        {stage === 'generating' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">{phaseLabel || '🔄 准备中...'}</h3>
              <span className="text-sm font-mono text-indigo-600">{Math.round(displayProgress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-linear"
                style={{ width: `${displayProgress}%` }} />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">❌ {error}</div>
        )}

        {stage === 'done' && result?.script && (
          <ResultPanel script={result.script} />
        )}
      </div>
    </div>
  )
}

export default App
