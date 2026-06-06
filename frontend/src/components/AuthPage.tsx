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
      style={{ background: 'linear-gradient(160deg, #faf8f5 0%, #f0ebe0 50%, #f5f0e8 100%)' }}>
      <div className="w-full max-w-[360px]">
        <div className="text-center mb-10">
          <h1 className="font-serif text-[28px] font-bold text-ink tracking-tight mb-2">
            小说转剧本工坊
          </h1>
          <p className="text-[13px] text-warm-gray-light leading-relaxed">
            将文字编成光影，让故事登上舞台
          </p>
        </div>

        <div className="card-warm p-7">
          <div className="space-y-4">
            <div>
              <label className="text-[11px] text-warm-gray-light uppercase tracking-wider mb-1 block">用户名</label>
              <input
                className="input-underline placeholder:text-warm-gray-light/50"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
                placeholder="输入用户名"
              />
            </div>
            <div>
              <label className="text-[11px] text-warm-gray-light uppercase tracking-wider mb-1 block">密码</label>
              <input
                className="input-underline placeholder:text-warm-gray-light/50"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
                placeholder="输入密码"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-500 mt-4">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading || !username.trim() || !password.trim()}
            className="w-full py-3 rounded-lg bg-ink text-white font-medium text-[14px]
                       hover:bg-accent-hover disabled:bg-warm-gray-light disabled:cursor-not-allowed
                       transition-colors mt-6 tracking-wide"
          >
            {loading ? '...' : mode === 'login' ? '进入工坊' : '创建账户'}
          </button>

          <p className="text-center mt-5 text-[12px] text-warm-gray-light">
            {mode === 'login' ? '还没有账户？' : '已有账户？'}
            <button
              className="text-ink font-medium ml-1 hover:underline"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
            >
              {mode === 'login' ? '创建账户' : '去登录'}
            </button>
          </p>
        </div>

        <p className="text-center mt-10 text-[11px] text-warm-gray-light/70 tracking-wide">
          从小说到剧本，AI 铺就改编之路
        </p>
      </div>
    </div>
  )
}
