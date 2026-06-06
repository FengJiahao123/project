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
        apiListRevisions(p.id).then((list) => {
          setRevisions((prev) => ({ ...prev, [p.id]: list }))
        })
      }
    }
  }, [projects])

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const handleDelete = async (id: number) => {
    await apiDeleteProject(id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-indigo-700">🎬 我的项目</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{username}</span>
            <button onClick={onLogout} className="text-xs text-gray-400 hover:text-gray-600">退出</button>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-gray-400 py-8">加载中...</p>
        ) : projects.length === 0 ? (
          <p className="text-center text-gray-400 py-8">还没有项目，点击下方按钮创建</p>
        ) : (
          <div className="space-y-2 mb-6 max-h-96 overflow-auto">
            {projects.map((p) => {
              const revs = revisions[p.id] || []
              const hasRevisions = revs.length > 0
              return (
                <div key={p.id}>
                  <div
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors border ${expandedId === p.id ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-transparent hover:bg-indigo-50'
                      }`}
                    onClick={() => toggleExpand(p.id)}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-400">
                        {p.updated_at?.slice(0, 10)}
                        {hasRevisions && (
                          <span className="ml-2 text-indigo-500 font-medium">{revs.length} 个版本</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpen(p.id, p.name) }}
                        className="text-xs px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                      >
                        新建转化
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}
                        className="text-xs text-red-400 hover:text-red-600"
                      >删除</button>
                    </div>
                  </div>

                  {expandedId !== p.id && hasRevisions && (
                    <div className="text-xs text-gray-400 text-center py-1">
                      👆 点击展开查看 {revs.length} 个历史版本
                    </div>
                  )}
                  {expandedId !== p.id && !hasRevisions && (
                    <div className="text-xs text-gray-300 text-center py-1">
                      暂无转换记录
                    </div>
                  )}

                  {expandedId === p.id && (
                    <div className="ml-2 mt-1 mb-2 border-l-2 border-indigo-200 pl-4 space-y-1">
                      <div className="text-xs text-gray-400 mb-2">
                        {hasRevisions ? '📋 历史版本（点击查看）' : '暂无转换记录'}
                      </div>
                      {revs.slice(0, 10).map((r: any) => (
                        <div
                          key={r.id}
                          className="text-xs py-1.5 px-2 rounded hover:bg-indigo-50 cursor-pointer transition-colors flex items-start gap-3"
                          onClick={(e) => { e.stopPropagation(); onOpenRevision(p.id, p.name, r.id) }}
                        >
                          <span className="text-gray-300 shrink-0 mt-0.5">{r.created_at?.slice(5, 10)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-800 break-all">
                              📖 {r.summary || `版本 ${r.version}`}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-gray-400">
                              {r.chapter_count > 0 && <span>{r.chapter_count}章</span>}
                              {r.scene_count > 0 && <span>{r.scene_count}场景</span>}
                              <span>{r.action}</span>
                            </div>
                          </div>
                          <span className="text-indigo-400 text-[10px] shrink-0 mt-0.5">查看 →</span>
                        </div>
                      ))}
                      {revs.length > 10 && (
                        <p className="text-xs text-gray-400">... 还有 {revs.length - 10} 个版本</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <button
          onClick={onNew}
          className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          ＋ 新建项目
        </button>
      </div>
    </div>
  )
}
