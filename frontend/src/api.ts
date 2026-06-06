import type { ConvertResponse, RevisionResponse, OutlineResponse, Script } from './types'

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

export async function analyzeOutline(text: string): Promise<OutlineResponse> {
  const resp = await fetch(`${BASE}/outline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(err.detail ?? '大纲分析失败')
  }
  return resp.json()
}

export async function submitRevision(
  script: Script,
  instruction: string,
): Promise<RevisionResponse> {
  const resp = await fetch(`${BASE}/revision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ script, instruction }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(err.detail ?? 'AI 修改失败')
  }
  return resp.json()
}
