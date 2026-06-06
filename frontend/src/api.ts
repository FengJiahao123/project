import type { ConvertResponse, RevisionResponse, OutlineResponse, Script, ChaptersResponse } from './types'

const BASE = '/api'

export async function submitConvert(
  text: string, outline?: OutlineResponse, chapterIndices?: number[]
): Promise<ConvertResponse> {
  const resp = await fetch(`${BASE}/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, outline: outline || null, chapter_indices: chapterIndices || null }),
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

export async function detectChapters(text: string): Promise<ChaptersResponse> {
  const resp = await fetch(`${BASE}/chapters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(err.detail ?? '章节检测失败')
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

export async function checkConfig(): Promise<{ api_key_set: boolean }> {
  const resp = await fetch(`${BASE}/config`)
  return resp.json()
}

export async function setApiKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  const resp = await fetch(`${BASE}/config/key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(err.detail ?? '设置失败')
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
