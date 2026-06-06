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

  useEffect(() => {
    apiListProjects().then(setProjects).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    for (const p of projects) {
      if (!revisions[p.id]) {
        apiListRevisions(p.id).then((list) => setRevisions((prev) => ({ ...prev, [p.id]: list })))
      }
    }
  }, [projects])

  const toggleExpand = (id: number) => setExpandedId((prev) => (prev === id ? null : id))

  const handleDelete = async (id: number) => {
    await apiDeleteProject(id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(180deg, #faf8f5 0%, #f5f0e8 100%)' }}>
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-2xl font-bold text-ink">创作项目</h1>
            <p className="text-xs text-warm-gray mt-1">管理你的剧本改编</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-warm-gray-light">{username}</span>
            <button onClick={onLogout} className="text-xs text-warm-gray hover:text-ink transition-colors">
              退出
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-warm-gray py-12 text-sm">加载中...</p>
        ) : (
          <>
            {projects.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm text-warm-gray">还没有项目</p>
                <p className="text-xs text-warm-gray-light mt-1">创建第一个项目开始改编吧</p>
              </div>
            )}

            <div className="space-y-3 mb-6">
              {projects.map((p) => {
                const revs = revisions[p.id] || []
                const hasRevisions = revs.length > 0

                return (
                  <div key={p.id} className="card-warm overflow-hidden">
                    <div
                      className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-soft-amber/50 transition-colors"
                      onClick={() => toggleExpand(p.id)}
                    >
                      <div>
                        <h3 className="text-sm font-medium text-ink">{p.name}</h3>
                        <p className="text-xs text-warm-gray-light mt-0.5">
                          {p.updated_at?.slice(0, 10)}
                          {hasRevisions && (
                            <span className="ml-2 text-ink/60">{revs.length} 个版本</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpen(p.id, p.name) }}
                          className="text-xs px-3 py-1.5 bg-ink text-white rounded-lg hover:bg-accent-hover transition-colors"
                        >新建转化</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}
                          className="text-xs text-warm-gray-light hover:text-red-500 transition-colors"
                        >删除</button>
                      </div>
                    </div>

                    {/* Expand hint */}
                    {expandedId !== p.id && (
                      <div className="text-center pb-3">
                        <button
                          onClick={() => toggleExpand(p.id)}
                          className="text-xs text-warm-gray-light hover:text-ink transition-colors"
                        >
                          {hasRevisions ? `查看 ${revs.length} 个历史版本` : '暂无记录'}
                        </button>
                      </div>
                    )}

                    {/* Expanded */}
                    {expandedId === p.id && (
                      <div className="border-t border-border px-5 py-3">
                        <p className="text-xs text-warm-gray-light mb-3">历史版本</p>
                        <div className="space-y-1.5">
                          {revs.length === 0 && <p className="text-xs text-warm-gray-light">暂无记录</p>}
                          {revs.slice(0, 10).map((r: any) => (
                            <div
                              key={r.id}
                              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-soft-amber/40 cursor-pointer transition-colors"
                              onClick={(e) => { e.stopPropagation(); onOpenRevision(p.id, p.name, r.id) }}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-ink break-all">
                                  {r.summary || `版本 ${r.version}`}
                                </p>
                                <p className="text-xs text-warm-gray-light mt-0.5">
                                  {r.chapter_count > 0 && <span>{r.chapter_count}章</span>}
                                  {r.scene_count > 0 && <span className="ml-2">{r.scene_count}场景</span>}
                                  <span className="ml-2">{r.action}</span>
                                  <span className="ml-2">{r.created_at?.slice(0, 10)}</span>
                                </p>
                              </div>
                              <span className="text-xs text-warm-gray-light shrink-0 ml-3">查看</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <button
              onClick={onNew}
              className="w-full py-3 border-2 border-dashed border-border rounded-xl text-sm text-warm-gray-light
                         hover:text-ink hover:border-warm-gray-light transition-colors"
            >
              创建新项目
            </button>
          </>
        )}
      </div>
    </div>
  )
}
