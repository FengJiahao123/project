import type { ConvertResponse } from './types'

const BASE = '/api'

export async function submitConvert(text: string): Promise<ConvertResponse> {
  const resp = await fetch(`${BASE}/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(err.detail ?? '请求失败')
  }
  return resp.json()
}

export async function getStatus(taskId: string): Promise<ConvertResponse> {
  const resp = await fetch(`${BASE}/convert/${taskId}`)
  if (!resp.ok) {
    throw new Error('获取状态失败')
  }
  return resp.json()
}
