import { useState, useRef, useCallback, useEffect } from 'react'
import InputSection from './components/InputSection'
import ChapterSelector from './components/ChapterSelector'
import ResultPanel from './components/ResultPanel'
import AuthPage from './components/AuthPage'
import ProjectList from './components/ProjectList'
import Icon from './components/Icon'
import SettingsPage from './components/SettingsPage'
import { submitConvert, getStatus, detectChapters, setApiKey, checkConfig, apiCreateProject, apiGetProject, apiSaveProject, apiListProjects, apiAddRevision, apiGetRevision } from './api'
import type { ConvertResponse, ChapterInfo } from './types'

const PHASE_CONFIG = [
  { max: 35, speed: 0.12, label: '正在理解全文脉络' },
  { max: 70, speed: 0.08, label: '正在分析角色与场景' },
  { max: 90, speed: 0.04, label: '正在编写剧本内容' },
]

function App() {
  // ====== Auth ======
  const [token, setToken] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [view, setView] = useState<'projects' | 'editor'>('projects')
  const [projectId, setProjectId] = useState<number | null>(null)
  const [projectName, setProjectName] = useState('')
  const currentRevisionId = useRef(0)
  const [authChecked, setAuthChecked] = useState(false)

  // Token with 30-min inactivity expiry
  useEffect(() => {
    const stored = localStorage.getItem('token')
    const stamp = localStorage.getItem('token_time')
    const expired = stamp ? (Date.now() - Number(stamp)) > 30 * 60 * 1000 : true
    if (stored && !expired) {
      localStorage.setItem('token_time', Date.now().toString())
      setToken(stored)
      setUsername(localStorage.getItem('username') || '')
      apiListProjects()
        .then(() => setAuthChecked(true))
        .catch(() => { ['token','username','token_time'].forEach(k => localStorage.removeItem(k)); setToken(null); setAuthChecked(true) })
    } else {
      if (stored && expired) ['token','username','token_time'].forEach(k => localStorage.removeItem(k))
      setAuthChecked(true)
    }
  }, [])

  const handleLogin = (t: string, name: string) => {
    setToken(t); setUsername(name); setAuthChecked(true); setView('projects')
  }
  const handleLogout = () => {
    ['token','username','token_time'].forEach(k => localStorage.removeItem(k))
    setToken(null); setUsername(''); setView('projects')
  }
  const onLogout = handleLogout

  // User menu + settings
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

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
    <div className="min-h-screen bg-paper">
      {/* ===== Top Nav ===== */}
      <nav className="sticky top-0 z-40 bg-cream/85 backdrop-blur-md border-b border-border">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={handleBackToProjects} className="text-xs text-warm-gray-light hover:text-ink transition-colors flex items-center gap-1">
              <Icon name="chevronLeft" size={14} />项目列表
            </button>
            <span className="text-border select-none">|</span>
            <h1 className="font-serif text-base font-bold text-ink">{projectName}</h1>
          </div>

          <div className="flex items-center gap-2">
            {!apiKeySet && (
              <button onClick={() => setShowKeyInput(true)}
                className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-full transition-colors">
                <Icon name="key" size={12} />设置 API Key
              </button>
            )}
            {/* User dropdown */}
            <div className="relative">
              <button onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-8 h-8 rounded-full bg-ink/8 flex items-center justify-center hover:bg-ink/12 transition-colors text-ink/60">
                <Icon name="user" size={15} />
              </button>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-ivory border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-medium text-ink">{username}</p>
                      <p className="text-[11px] text-warm-gray-light mt-0.5">{apiKeySet ? <>Key ···{apiKey.slice(-4)}</> : '未设置 API Key'}</p>
                    </div>
                    <div className="py-1">
                      <button className="dropdown-item" onClick={() => { setShowUserMenu(false); setShowSettings(true) }}>
                        <Icon name="settings" size={14} /><span>个人设置</span>
                      </button>
                      <button className="dropdown-item" onClick={() => { setShowUserMenu(false); setShowKeyInput(true) }}>
                        <Icon name="key" size={14} /><span>{apiKeySet ? '更换 API Key' : '设置 API Key'}</span>
                      </button>
                      <div className="dropdown-divider" />
                      <button className="dropdown-item" onClick={() => { setShowUserMenu(false); onLogout() }}>
                        <Icon name="logOut" size={14} /><span>退出登录</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ===== API Key Modal ===== */}
      {showKeyInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setShowKeyInput(false)}>
          <div className="bg-ivory rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center"><Icon name="key" size={15} className="text-amber-700" /></div>
              <h3 className="font-serif text-base font-semibold text-ink">设置 API Key</h3>
            </div>
            <p className="text-xs text-warm-gray-light mb-4">输入 DeepSeek API Key，用于驱动 AI 转换引擎。Key 仅保存在当前服务器内存中，不会持久化到磁盘。</p>
            <input className="w-full px-3 py-2.5 border border-border rounded-lg text-sm font-mono outline-none focus:border-ink mb-3"
              type="password" placeholder="sk-..." value={apiKey}
              onChange={(e) => setApiKeyState(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSetKey() }}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowKeyInput(false); setApiKeyState('') }}
                className="px-4 py-2 text-xs text-warm-gray hover:text-ink transition-colors">取消</button>
              <button onClick={handleSetKey} disabled={!apiKey.trim()}
                className="px-4 py-2 bg-ink text-white text-xs rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors">保存并启用</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== API Key Card — inline, cannot miss ===== */}
      {!apiKeySet && (
        <div className="card-warm p-6 mt-6 border-2 border-amber-400 bg-amber-50/30">
          <div className="text-center mb-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-2">
              <Icon name="key" size={22} className="text-amber-700" />
            </div>
            <h3 className="font-serif text-lg font-bold text-amber-900">开始使用前需要设置 API Key</h3>
            <p className="text-sm text-amber-700 mt-1">输入你的 DeepSeek API Key，仅在当前会话使用，不存盘</p>
          </div>
          <div className="flex items-center gap-2 max-w-md mx-auto">
            <input
              className="flex-1 px-4 py-3 border-2 border-amber-400 rounded-lg font-mono text-sm outline-none focus:border-amber-600 bg-white"
              type="password" placeholder="sk-..." value={apiKey}
              onChange={(e) => setApiKeyState(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSetKey() }}
              autoFocus
            />
            <button onClick={handleSetKey} disabled={!apiKey.trim()}
              className="px-6 py-3 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors whitespace-nowrap">
              启用
            </button>
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

      {/* ===== Settings Modal ===== */}
      {showSettings && (
        <SettingsPage
          username={username}
          onClose={() => setShowSettings(false)}
          onLogout={onLogout}
        />
      )}

    </div>
  )
}

export default App
