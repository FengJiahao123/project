import { useState, useEffect } from 'react'
import { apiListProjects, apiDeleteProject, apiListRevisions } from '../api'

interface Project {
  id: number
  name: string
  created_at: string
  updated_at: string
}

interface Props {
  onOpen: (projectId: number, name: string) => void
  onOpenRevision: (projectId: number, name: string, revisionId: number) => void
  onNew: () => void
  onLogout: () => void
  username: string
}

export default function ProjectList({ onOpen, onOpenRevision, onNew, onLogout, username }: Props) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [revisions, setRevisions] = useState<Record<number, any[]>>({})

  useEffect(() => { apiListProjects().then(setProjects).finally(() => setLoading(false)) }, [])
  const handleDelete = async (id: number) => { await apiDeleteProject(id); setProjects(prev => prev.filter(p => p.id !== id)) }
  useEffect(() => {
    for (const p of projects) {
      if (!revisions[p.id]) apiListRevisions(p.id).then((list) => setRevisions((prev) => ({ ...prev, [p.id]: list })))
    }
  }, [projects])

  return (
    <div className="min-h-screen" style={{ background: '#faf8f5' }}>
      {/* Top Nav */}
      <nav className="sticky top-0 z-40 bg-cream/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <h1 className="font-serif text-lg font-bold text-ink">创作项目</h1>
          <div className="flex items-center gap-4">
            <span className="text-xs text-warm-gray-light">{username}</span>
            <button onClick={onLogout} className="text-xs text-warm-gray-light hover:text-ink transition-colors">退出登录</button>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto py-10 px-4">
        {loading ? (
          <p className="text-center text-warm-gray-light py-16 text-sm">加载中...</p>
        ) : (
          <>
            {projects.length === 0 && (
              <div className="text-center py-16">
                <p className="text-warm-gray text-sm">还没有项目</p>
                <p className="text-warm-gray-light text-xs mt-1">创建第一个项目开始改编吧</p>
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
                      <div>
                        <h3 className="text-sm font-medium text-ink">{p.name}</h3>
                        <p className="text-xs text-warm-gray-light mt-0.5">
                          {p.updated_at?.slice(0, 10)}
                          {revs.length > 0 && <span className="ml-2">{revs.length} 个版本</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); onOpen(p.id, p.name) }}
                          className="text-xs px-3 py-1.5 bg-ink text-white rounded-lg hover:bg-accent-hover transition-colors">新建转化</button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}
                          className="text-xs text-warm-gray-light hover:text-red-500 transition-colors">删除</button>
                      </div>
                    </div>

                    {expandedId !== p.id && revs.length > 0 && (
                      <div className="text-center pb-3">
                        <button onClick={() => setExpandedId(p.id)}
                          className="text-xs text-warm-gray-light hover:text-ink transition-colors">查看 {revs.length} 个历史版本</button>
                      </div>
                    )}

                    {expandedId === p.id && (
                      <div className="border-t border-border px-5 py-3">
                        <p className="text-[10px] text-warm-gray-light uppercase tracking-wider mb-3">历史版本</p>
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
                              <span className="text-[10px] text-warm-gray-light shrink-0 ml-3">查看</span>
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
              className="w-full py-3 border-2 border-dashed border-border rounded-xl text-sm text-warm-gray-light
                         hover:text-ink hover:border-warm-gray-light transition-colors">
              创建新项目
            </button>
          </>
        )}
      </div>
    </div>
  )
}
