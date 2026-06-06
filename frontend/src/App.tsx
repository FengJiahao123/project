import { useState, useRef, useCallback, useEffect } from 'react'
import InputSection from './components/InputSection'
import ChapterSelector from './components/ChapterSelector'
import ResultPanel from './components/ResultPanel'
import AuthPage from './components/AuthPage'
import ProjectList from './components/ProjectList'
import { submitConvert, getStatus, detectChapters, setApiKey, checkConfig, apiCreateProject, apiGetProject, apiSaveProject, apiListProjects, apiAddRevision, apiGetRevision } from './api'
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
  const currentRevisionId = useRef(0)    // 当前会话的版本ID, 修改时更新同一条
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
      setProjectId(result.project_id); setProjectName(name)
      currentRevisionId.current = 0
      setStage('input'); setResult(null); setError(null)
      setChapters([]); setFullText(''); setDisplayProgress(0)
      setView('editor')
    }
  }

  const handleOpenProject = async (id: number, name: string) => {
    setProjectId(id); setProjectName(name)
    currentRevisionId.current = 0   // 新会话，新版本
    setStage('input'); setResult(null); setError(null)
    setChapters([]); setFullText(''); setDisplayProgress(0); setPhaseLabel('')
    clearAnim(); stopPolling()
    const proj = await apiGetProject(id)
    if (proj.original_text) setFullText(proj.original_text)
    setView('editor')
  }

  const handleBackToProjects = () => {
    setView('projects');
    setProjectId(null); setResult(null); setError(null)
    setStage('input'); setChapters([]); setFullText(''); setDisplayProgress(0)
    clearAnim(); stopPolling()
  }

  const handleOpenRevision = async (id: number, name: string, revisionId: number) => {
    isViewingHistory.current = true
    setProjectId(id); setProjectName(name)
    setStage('done')
    try {
      const rev = await apiGetRevision(id, revisionId)
      if (rev.script_json) {
        const script = JSON.parse(rev.script_json)
        setResult({
          task_id: null, status: 'completed', progress: 100,
          chapters: rev.chapter_names ? rev.chapter_names.split(', ') : [],
          script, error: null,
        })
      }
    } catch (e) {
      setError('加载历史版本失败')
    }
    setView('editor')
  }

  // ====== App State ======
  const [stage, setStage] = useState<'input' | 'chapterSelect' | 'generating' | 'done'>('input')
  const [result, setResult] = useState<ConvertResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isViewingHistory = useRef(false)

  // Save script + record revision after each NEW generation only
  useEffect(() => {
    if (result?.status === 'completed' && result.script && projectId && !isViewingHistory.current) {
      const json = JSON.stringify(result.script)
      const sceneCount = result.script.scenes?.length || 0
      const chapterCount = result.chapters?.length || 0
      apiSaveProject(projectId, fullText, json).catch(() => {})
      const chapterNames = (result.chapters || []).join(', ')
      apiAddRevision(projectId, 'AI 生成', json, chapterCount, sceneCount, chapterNames, currentRevisionId.current)
        .then((r) => { if (r.revision_id) currentRevisionId.current = r.revision_id })
        .catch(() => {})
    }
    isViewingHistory.current = false  // reset after handling
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
      const config = await checkConfig()
      setApiKeySet(config.api_key_set)
      setShowKeyInput(false)
      setApiKeyState('')
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '设置 API Key 失败')
      setApiKeySet(false)
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
          if (status.status === 'completed') {
            stopPolling()
            realDoneRef.current = true
            setTimeout(() => {
              clearAnim()
              setDisplayProgress(100)
              setPhaseLabel('✅ 转换完成')
              setStage('done')
            }, 2000)
          } else if (status.status === 'error') {
            stopPolling()
            clearAnim()
            setError(status.error || '转换失败，请重试')
            setStage('input')
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : '轮询失败')
          stopPolling()
          clearAnim()
          setStage('chapterSelect')
        }
      }, 1000)
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
  if (!authChecked) return <div className="min-h-screen flex items-center justify-center" style={{background:'#faf8f5'}}><p className="text-sm text-warm-gray">加载中...</p></div>
  if (!token) return <AuthPage onLogin={handleLogin} />
  if (view === 'projects') {
    return <ProjectList onOpen={handleOpenProject} onOpenRevision={handleOpenRevision} onNew={handleNewProject} onLogout={handleLogout} username={username} />
  }

  return (
    <div className="min-h-screen" style={{background: 'linear-gradient(180deg, #faf8f5 0%, #f5f0e8 100%)'}}>
      <div className="max-w-3xl mx-auto py-10 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button onClick={handleBackToProjects} className="text-xs text-warm-gray-light hover:text-ink transition-colors mb-2 block">
              ← 返回项目列表
            </button>
            <h1 className="font-serif text-2xl font-bold text-ink">{projectName}</h1>
          </div>
          <div className="flex items-center gap-2">
            {apiKeySet ? (
              <span className="text-xs text-warm-gray-light bg-soft-amber px-2.5 py-1 rounded-full">Key 已设置</span>
            ) : (
              <button onClick={() => setShowKeyInput(true)} className="text-xs text-warm-gray-light hover:text-ink underline">
                设置 API Key
              </button>
            )}
          </div>
        </div>

        {/* API Key input (collapsed) */}
        {showKeyInput && !apiKeySet && (
          <div className="card-warm p-4 mb-4 flex items-center gap-3">
            <span className="text-xs text-warm-gray shrink-0">DeepSeek API Key：</span>
            <input className="flex-1 text-xs px-3 py-1.5 border border-border rounded outline-none focus:border-warm-gray-light font-mono"
              type="password" placeholder="sk-..." value={apiKey}
              onChange={(e) => setApiKeyState(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSetKey() }}
            />
            <button onClick={handleSetKey} disabled={!apiKey.trim()}
              className="text-xs px-3 py-1.5 bg-ink text-white rounded hover:bg-accent-hover disabled:opacity-50 transition-colors">保存</button>
            <button onClick={() => setShowKeyInput(false)} className="text-xs text-warm-gray-light hover:text-ink">取消</button>
          </div>
        )}

        {showKeyInput && apiKeySet && (
          <div className="card-warm p-4 mb-4 flex items-center gap-3">
            <span className="text-xs text-warm-gray">更换 Key：</span>
            <input className="flex-1 text-xs px-3 py-1.5 border border-border rounded outline-none focus:border-warm-gray-light font-mono"
              type="password" placeholder="sk-..." value={apiKey}
              onChange={(e) => setApiKeyState(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSetKey() }}
            />
            <button onClick={handleSetKey} disabled={!apiKey.trim()}
              className="text-xs px-3 py-1.5 bg-ink text-white rounded hover:bg-accent-hover disabled:opacity-50 transition-colors">保存</button>
            <button onClick={() => { setShowKeyInput(false); setApiKeyState('') }} className="text-xs text-warm-gray-light hover:text-ink">取消</button>
          </div>
        )}

        <InputSection onSubmit={handleDetect} disabled={stage === 'generating' || detectLoading} />

        {detectLoading && (
          <div className="card-warm p-6 mt-6 text-center">
            <p className="text-sm text-warm-gray">正在检测章节...</p>
          </div>
        )}

        {stage === 'chapterSelect' && chapters.length > 0 && (
          <ChapterSelector chapters={chapters} onSubmit={handleStartConvert}
            onCancel={() => { setStage('input'); setChapters([]) }} />
        )}

        {stage === 'generating' && (
          <div className="card-warm p-6 mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm text-warm-gray">{phaseLabel || '准备中...'}</h3>
              <span className="text-sm font-mono text-ink/60">{Math.round(displayProgress)}%</span>
            </div>
            <div className="w-full bg-soft-amber rounded-full h-1.5">
              <div className="bg-ink h-1.5 rounded-full transition-all duration-300 ease-linear"
                style={{ width: `${displayProgress}%` }} />
            </div>
          </div>
        )}

        {error && (
          <div className="card-warm p-4 mt-6 text-sm text-merlot">{error}</div>
        )}

        {stage === 'done' && result?.script && (
          <ResultPanel script={result.script} />
        )}
      </div>
    </div>
  )
}

export default App
