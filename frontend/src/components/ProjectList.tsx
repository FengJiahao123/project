import { useState, useEffect } from 'react'
import { apiListProjects, apiDeleteProject, apiListRevisions } from '../api'
import Icon from './Icon'

interface Project {
  id: number; name: string; created_at: string; updated_at: string
}

interface Props {
  onOpen: (id: number, name: string) => void
  onOpenRevision: (id: number, name: string, revisionId: number) => void
  onNew: () => void
  onLogout: () => void
  username: string
}

export default function ProjectList({ onOpen, onOpenRevision, onNew, onLogout, username }: Props) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [revisions, setRevisions] = useState<Record<number, any[]>>({})
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  useEffect(() => { apiListProjects().then(setProjects).finally(() => setLoading(false)) }, [])
  useEffect(() => {
    for (const p of projects) {
      if (!revisions[p.id]) apiListRevisions(p.id).then((list) => setRevisions((prev) => ({ ...prev, [p.id]: list })))
    }
  }, [projects])

  const handleDelete = async (id: number) => { await apiDeleteProject(id); setProjects(prev => prev.filter(p => p.id !== id)) }

  return (
    <div className="min-h-screen bg-paper">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-cream/85 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <h1 className="font-serif text-lg font-bold text-ink flex items-center gap-2">
            <Icon name="sparkles" size={18} />
            创作项目
          </h1>

          {/* User dropdown */}
          <div className="relative">
            <button onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-8 h-8 rounded-full bg-ink/8 flex items-center justify-center hover:bg-ink/12 transition-colors text-ink/60">
              <Icon name="user" size={15} />
            </button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-ivory border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-medium text-ink">{username}</p>
                    <p className="text-[11px] text-warm-gray-light mt-0.5">创作工坊 · 个人账户</p>
                  </div>
                  <div className="py-1">
                    <button className="dropdown-item" onClick={() => { setUserMenuOpen(false) }}>
                      <Icon name="settings" size={14} /><span>个人设置</span>
                    </button>
                    <button className="dropdown-item" onClick={() => { setUserMenuOpen(false); onLogout() }}>
                      <Icon name="logOut" size={14} /><span>退出登录</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto py-12 px-4">
        {loading ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-6 h-6 border-2 border-ink/20 border-t-ink/60 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-warm-gray-light">加载中...</p>
          </div>
        ) : (
          <>
            {projects.length === 0 && (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-soft-amber/60 flex items-center justify-center mx-auto mb-4">
                  <Icon name="file" size={24} className="text-warm-gray-light" />
                </div>
                <p className="text-ink font-serif text-lg font-medium mb-1">创建你的第一个改编项目</p>
                <p className="text-warm-gray-light text-xs">上传小说，AI 帮你转化为专业剧本</p>
              </div>
            )}

            <div className="space-y-3 mb-8">
              {projects.map((p) => {
                const revs = revisions[p.id] || []
                return (
                  <div key={p.id} className="card-warm overflow-hidden">
                    <div
                      className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-soft-amber/40 transition-colors"
                      onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-soft-amber flex items-center justify-center">
                          <Icon name="file" size={15} className="text-warm-gray" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-ink">{p.name}</h3>
                          <p className="text-[11px] text-warm-gray-light mt-0.5">
                            {p.updated_at?.slice(0, 10)}
                            {revs.length > 0 && <span className="ml-2 text-ink/50">{revs.length} 个版本</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); onOpen(p.id, p.name) }}
                          className="text-xs px-3 py-1.5 bg-ink text-white rounded-lg hover:bg-accent-hover transition-colors">新建转化</button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}
                          className="p-1 rounded hover:bg-red-50 transition-colors text-warm-gray-light hover:text-red-500"><Icon name="trash" size={13} /></button>
                      </div>
                    </div>
                    {expandedId !== p.id && revs.length > 0 && (
                      <div className="text-center pb-3">
                        <button onClick={() => setExpandedId(p.id)} className="text-[11px] text-warm-gray-light hover:text-ink transition-colors">查看 {revs.length} 个历史版本</button>
                      </div>
                    )}
                    {expandedId === p.id && (
                      <div className="border-t border-border px-5 py-3">
                        <p className="text-[10px] text-warm-gray-light uppercase tracking-wider mb-3 flex items-center gap-1.5"><Icon name="clock" size={11} />历史版本</p>
                        <div className="space-y-1">
                          {revs.length === 0 && <p className="text-xs text-warm-gray-light">暂无记录</p>}
                          {revs.slice(0, 10).map((r: any) => (
                            <div key={r.id}
                              className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-soft-amber/40 cursor-pointer transition-colors"
                              onClick={(e) => { e.stopPropagation(); onOpenRevision(p.id, p.name, r.id) }}>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-ink break-all">{r.summary || `版本 ${r.version}`}</p>
                                <p className="text-[11px] text-warm-gray-light mt-0.5">
                                  {r.chapter_count > 0 && <span>{r.chapter_count}章</span>}
                                  {r.scene_count > 0 && <span className="ml-1.5">{r.scene_count}场景</span>}
                                  <span className="ml-1.5">{r.action}</span>
                                  <span className="ml-1.5">{r.created_at?.slice(0, 10)}</span>
                                </p>
                              </div>
                              <span className="text-[10px] text-warm-gray-light shrink-0 ml-3 flex items-center gap-0.5">查看<Icon name="arrowRight" size={10} /></span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <button onClick={onNew}
              className="w-full py-4 border-2 border-dashed border-border rounded-xl text-sm text-warm-gray-light
                         hover:text-ink hover:border-warm-gray-light transition-colors flex items-center justify-center gap-2">
              <Icon name="plus" size={14} />创建新项目
            </button>
          </>
        )}
      </div>
    </div>
  )
}
