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
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(180deg, #faf8f5 0%, #f5f0e8 100%)' }}>
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-serif text-3xl font-bold text-ink tracking-wide mb-3">
            小说转剧本工坊
          </h1>
          <p className="text-sm text-warm-gray leading-relaxed">
            {mode === 'login' ? '将文字编成光影，让故事登上舞台' : '创建你的创作空间'}
          </p>
        </div>

        {/* Card */}
        <div className="card-warm p-8">
          <div className="space-y-5">
            <div>
              <label className="text-xs text-warm-gray mb-1 block">用户名</label>
              <input
                className="input-underline"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
                placeholder="输入用户名"
              />
            </div>
            <div>
              <label className="text-xs text-warm-gray mb-1 block">密码</label>
              <input
                className="input-underline"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
                placeholder="输入密码"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 mt-4">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !username.trim() || !password.trim()}
            className="w-full py-3 rounded-xl bg-ink text-white font-medium text-sm
                       hover:bg-accent-hover disabled:bg-warm-gray disabled:cursor-not-allowed
                       transition-colors mt-6"
          >
            {loading ? '...' : mode === 'login' ? '进入工坊' : '创建账户'}
          </button>

          <p className="text-center mt-5 text-xs text-warm-gray">
            {mode === 'login' ? '还没有账户？' : '已有账户？'}
            <button
              className="link ml-1 font-medium"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
            >
              {mode === 'login' ? '创建' : '登录'}
            </button>
          </p>
        </div>

        <p className="text-center mt-8 text-xs text-warm-gray-light">
          从小说到剧本，AI 为你铺就改编之路
        </p>
      </div>
    </div>
  )
}
