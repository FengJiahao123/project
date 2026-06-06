import { useState } from 'react'
import { apiLogin, apiRegister } from '../api'

interface Props {
  onLogin: (token: string, username: string) => void
}

export default function AuthPage({ onLogin }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) return
    setLoading(true)
    setError('')
    try {
      const fn = mode === 'login' ? apiLogin : apiRegister
      const result = await fn(username.trim(), password)
      if (result.ok) {
        localStorage.setItem('token', result.token)
        localStorage.setItem('username', result.username)
        onLogin(result.token, result.username)
      } else {
        setError(result.message)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-indigo-700">🎬 AI 小说转剧本</h1>
          <p className="text-sm text-gray-400 mt-1">
            {mode === 'login' ? '登录以继续' : '创建新账户'}
          </p>
        </div>

        <input
          className="w-full p-3 border border-gray-300 rounded-lg text-sm mb-3 focus:ring-2 focus:ring-indigo-500"
          placeholder="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
        />
        <input
          className="w-full p-3 border border-gray-300 rounded-lg text-sm mb-4 focus:ring-2 focus:ring-indigo-500"
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
        />

        {error && (
          <p className="text-sm text-red-500 mb-3">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !username.trim() || !password.trim()}
          className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-300 transition-colors"
        >
          {loading ? '...' : mode === 'login' ? '登录' : '注册'}
        </button>

        <p className="text-xs text-center mt-4 text-gray-400">
          {mode === 'login' ? '没有账户？' : '已有账户？'}
          <button
            className="text-indigo-600 hover:text-indigo-800 ml-1"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
          >
            {mode === 'login' ? '注册' : '去登录'}
          </button>
        </p>
      </div>
    </div>
  )
}
