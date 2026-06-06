import { useState, useEffect } from 'react'
import { apiGetProfile, apiUpdateProfile, apiChangePassword } from '../api'
import Icon from './Icon'

interface Props {
  username: string
  onClose: () => void
  onLogout: () => void
}

export default function SettingsPage({ username, onClose, onLogout }: Props) {
  const [displayName, setDisplayName] = useState('')
  const [projectCount, setProjectCount] = useState(0)
  const [revisionCount, setRevisionCount] = useState(0)
  const [createdAt, setCreatedAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // Password
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')

  useEffect(() => {
    apiGetProfile().then((p) => {
      setDisplayName(p.display_name || p.username)
      setProjectCount(p.project_count || 0)
      setRevisionCount(p.revision_count || 0)
      setCreatedAt(p.created_at?.slice(0, 10) || '')
    })
  }, [])

  const handleSaveName = async () => {
    setSaving(true)
    await apiUpdateProfile(displayName)
    setSaving(false)
    setMsg('已更新')
    setTimeout(() => setMsg(''), 2000)
  }

  const handleChangePwd = async () => {
    if (!oldPwd.trim() || !newPwd.trim()) return
    try {
      await apiChangePassword(oldPwd, newPwd)
      setPwdMsg('密码已修改')
      setOldPwd(''); setNewPwd('')
    } catch (e) {
      setPwdMsg(e instanceof Error ? e.message : '修改失败')
    }
    setTimeout(() => setPwdMsg(''), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={onClose}>
      <div className="bg-ivory rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-serif text-lg font-bold text-ink flex items-center gap-2">
            <Icon name="settings" size={18} />个人设置
          </h2>
          <button onClick={onClose} className="text-warm-gray-light hover:text-ink">
            <Icon name="chevronLeft" size={18} className="rotate-90" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Profile */}
          <section>
            <h3 className="text-[10px] text-warm-gray-light uppercase tracking-wider mb-3">个人资料</h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-soft-amber flex items-center justify-center">
                <Icon name="user" size={24} className="text-warm-gray" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink">{username}</p>
                <p className="text-xs text-warm-gray-light">{createdAt ? `于 ${createdAt} 加入` : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-ink"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="显示名称"
              />
              <button onClick={handleSaveName} disabled={saving}
                className="px-3 py-2 bg-ink text-white text-xs rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors">
                {msg || '保存'}
              </button>
            </div>
          </section>

          <div className="border-t border-border" />

          {/* Stats */}
          <section>
            <h3 className="text-[10px] text-warm-gray-light uppercase tracking-wider mb-3">使用统计</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-soft-amber/40 rounded-xl text-center">
                <p className="text-2xl font-bold text-ink font-serif">{projectCount}</p>
                <p className="text-[11px] text-warm-gray-light mt-0.5">项目数</p>
              </div>
              <div className="p-4 bg-soft-amber/40 rounded-xl text-center">
                <p className="text-2xl font-bold text-ink font-serif">{revisionCount}</p>
                <p className="text-[11px] text-warm-gray-light mt-0.5">转化次数</p>
              </div>
            </div>
          </section>

          <div className="border-t border-border" />

          {/* Change Password */}
          <section>
            <h3 className="text-[10px] text-warm-gray-light uppercase tracking-wider mb-3">修改密码</h3>
            <div className="space-y-2">
              <input className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-ink"
                type="password" placeholder="原密码" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)}
              />
              <input className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-ink"
                type="password" placeholder="新密码（至少 4 位）" value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
              />
              <div className="flex justify-between items-center">
                <button onClick={handleChangePwd} disabled={!oldPwd.trim() || !newPwd.trim()}
                  className="px-3 py-1.5 bg-ink text-white text-xs rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors">
                  修改密码
                </button>
                {pwdMsg && <span className="text-xs text-warm-gray">{pwdMsg}</span>}
              </div>
            </div>
          </section>

          <div className="border-t border-border" />

          {/* Logout */}
          <button onClick={onLogout}
            className="w-full py-2.5 border border-red-200 text-red-500 text-sm rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-2">
            <Icon name="logOut" size={14} />退出登录
          </button>
        </div>
      </div>
    </div>
  )
}
