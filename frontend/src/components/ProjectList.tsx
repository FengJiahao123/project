import { useState, useEffect } from 'react'
import { apiListProjects, apiDeleteProject } from '../api'

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

  useEffect(() => {
    apiListProjects().then(setProjects).finally(() => setLoading(false))
  }, [])

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
          <div className="space-y-2 mb-6">
            {projects.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-indigo-50 cursor-pointer transition-colors"
                onClick={() => onOpen(p.id, p.name)}
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.updated_at.slice(0, 10)}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  删除
                </button>
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
