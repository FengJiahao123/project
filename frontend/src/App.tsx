import { useState, useRef, useCallback, useEffect } from 'react'
import InputSection from './components/InputSection'
import ChapterSelector from './components/ChapterSelector'
import ResultPanel from './components/ResultPanel'
import AuthPage from './components/AuthPage'
import ProjectList from './components/ProjectList'
import { submitConvert, getStatus, detectChapters, setApiKey, checkConfig, apiCreateProject, apiGetProject, apiSaveProject, apiListProjects, apiAddRevision, apiGetRevision } from './api'
import type { ConvertResponse, ChapterInfo } from './types'

const PHASE_CONFIG = [
  { max: 35, speed: 0.12, label: '正在理解全文脉络' },
  { max: 70, speed: 0.08, label: '正在分析角色与场景' },
  { max: 90, speed: 0.04, label: '正在编写剧本内容' },
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
    setPhaseLabel('正在理解全文脉络')
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
    setPhaseLabel('正在理解全文脉络')
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
              setPhaseLabel('转换完成')
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
    <div className="min-h-screen" style={{background: '#faf8f5'}}>
      {/* ==== Top Nav ==== */}
      <nav className="sticky top-0 z-40 bg-cream/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={handleBackToProjects} className="text-xs text-warm-gray-light hover:text-ink transition-colors">
              ← 项目列表
            </button>
            <span className="text-border select-none">|</span>
            <h1 className="font-serif text-base font-bold text-ink">{projectName}</h1>
          </div>
          <div className="flex items-center gap-3">
            {apiKeySet ? (
              <button onClick={() => setShowKeyInput(true)} className="text-xs text-warm-gray-light bg-soft-amber/60 px-2.5 py-1 rounded-full hover:bg-soft-amber transition-colors">
                Key ···{apiKey.slice(-4)}
              </button>
            ) : (
              <button onClick={() => setShowKeyInput(true)} className="text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
                设置 API Key
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ==== API Key inline ==== */}
      {showKeyInput && (
        <div className="max-w-4xl mx-auto px-6 pt-3">
          <div className="card-warm p-3 flex items-center gap-3">
            <span className="text-xs text-warm-gray-light shrink-0">API Key</span>
            <input className="flex-1 text-xs px-2.5 py-1.5 border border-border rounded-lg outline-none focus:border-warm-gray-light font-mono"
              type="password" placeholder="sk-..." value={apiKey}
              onChange={(e) => setApiKeyState(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSetKey() }}
            />
            <button onClick={handleSetKey} disabled={!apiKey.trim()}
              className="text-xs px-3 py-1.5 bg-ink text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors">保存</button>
            <button onClick={() => { setShowKeyInput(false); setApiKeyState('') }} className="text-xs text-warm-gray-light hover:text-ink">取消</button>
          </div>
        </div>
      )}

      {/* ==== Main Content ==== */}
      <div className="max-w-3xl mx-auto py-8 px-4">
        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-6 text-xs">
          <span className={`px-2.5 py-1 rounded-full ${stage === 'input' || stage === 'chapterSelect' ? 'bg-ink text-white' : 'bg-soft-amber text-warm-gray'}`}>1</span>
          <span className="text-warm-gray-light">上传小说</span>
          <span className="text-border mx-1">→</span>
          <span className={`px-2.5 py-1 rounded-full ${stage === 'chapterSelect' ? 'bg-ink text-white' : stage === 'generating' || stage === 'done' ? 'bg-soft-amber text-warm-gray' : 'bg-soft-amber text-warm-gray'}`}>2</span>
          <span className="text-warm-gray-light">选择章节</span>
          <span className="text-border mx-1">→</span>
          <span className={`px-2.5 py-1 rounded-full ${stage === 'generating' || stage === 'done' ? 'bg-ink text-white' : 'bg-soft-amber text-warm-gray'}`}>3</span>
          <span className="text-warm-gray-light">生成剧本</span>
        </div>

        {/* Step 1: Input */}
        {(stage === 'input' || stage === 'chapterSelect' || stage === 'generating') && (
          <InputSection onSubmit={handleDetect} disabled={detectLoading || stage === 'generating'} showCompact={stage !== 'input'} />
        )}

        {detectLoading && (
          <div className="card-warm p-8 mt-6 text-center">
            <div className="w-6 h-6 border-2 border-ink/20 border-t-ink rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-warm-gray">正在分析章节结构...</p>
          </div>
        )}

        {/* Step 2: Chapter Select */}
        {stage === 'chapterSelect' && chapters.length > 0 && (
          <ChapterSelector chapters={chapters} onSubmit={handleStartConvert}
            onCancel={() => { setStage('input'); setChapters([]) }} />
        )}

        {/* Step 3: Generating */}
        {stage === 'generating' && (
          <div className="card-warm p-8 mt-6 text-center">
            <p className="font-serif text-base text-ink mb-1">{phaseLabel || '正在生成剧本...'}</p>
            <p className="text-sm text-warm-gray-light">{Math.round(displayProgress)}%</p>
            <div className="w-full bg-soft-amber rounded-full h-1.5 mt-5 max-w-xs mx-auto">
              <div className="bg-ink h-1.5 rounded-full transition-all duration-300 ease-linear"
                style={{ width: `${displayProgress}%` }} />
            </div>
          </div>
        )}

        {error && (
          <div className="card-warm p-4 mt-6 text-sm text-red-600 border-red-200">{error}</div>
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
