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
  onNew: () => void
  onLogout: () => void
  username: string
}

export default function ProjectList({ onOpen, onNew, onLogout, username }: Props) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  // Expanded project -> its revision list
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [revisions, setRevisions] = useState<Record<number, any[]>>({})

  useEffect(() => {
    apiListProjects().then(setProjects).finally(() => setLoading(false))
  }, [])

  const toggleExpand = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!revisions[id]) {
      const list = await apiListRevisions(id)
      setRevisions((prev) => ({ ...prev, [id]: list }))
    }
  }

  const handleDelete = async (id: number) => {
    await apiDeleteProject(id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-lg">
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
            {projects.map((p) => (
              <div key={p.id}>
                <div
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-indigo-50 cursor-pointer transition-colors"
                  onClick={() => toggleExpand(p.id)}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-400">
                      {p.updated_at?.slice(0, 10)}
                      {revisions[p.id]?.length > 0 && (
                        <span className="ml-2 text-indigo-500">{revisions[p.id].length} 个版本</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpen(p.id, p.name) }}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >打开</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}
                      className="text-xs text-red-400 hover:text-red-600"
                    >删除</button>
                  </div>
                </div>

                {/* Revision history */}
                {expandedId === p.id && revisions[p.id] && (
                  <div className="ml-4 mt-1 mb-2 border-l-2 border-indigo-100 pl-4 space-y-1">
                    {revisions[p.id].length === 0 ? (
                      <p className="text-xs text-gray-400 py-1">暂无记录</p>
                    ) : (
                      revisions[p.id].slice(0, 5).map((r: any) => (
                        <div key={r.id} className="text-xs text-gray-500 py-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-300">{r.created_at?.slice(0, 10)}</span>
                            <span className="font-medium text-gray-600">{r.summary}</span>
                            <span className="text-gray-400">{r.action}</span>
                          </div>
                          {r.chapter_names && (
                            <div className="text-gray-400 ml-2 mt-0.5 truncate max-w-xs">
                              📖 {r.chapter_names}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    {revisions[p.id].length > 5 && (
                      <p className="text-xs text-gray-400">... 还有 {revisions[p.id].length - 5} 个版本</p>
                    )}
                  </div>
                )}
              </div>
            ))}
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
