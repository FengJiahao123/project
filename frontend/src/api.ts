import type { ConvertResponse, RevisionResponse, OutlineResponse, Script, ChaptersResponse } from './types'

const BASE = '/api'

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function headers(): Record<string, string> {
  return { 'Content-Type': 'application/json', ...authHeaders() }
}

// ====== Auth ======

export async function apiLogin(username: string, password: string) {
  const resp = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return resp.json()
}

export async function apiRegister(username: string, password: string) {
  const resp = await fetch(`${BASE}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return resp.json()
}

// ====== Projects ======

export async function apiListProjects() {
  const resp = await fetch(`${BASE}/projects`, { headers: headers() })
  if (!resp.ok) throw new Error('Unauthorized')
  return resp.json()
}

export async function apiCreateProject(name: string, text: string = '') {
  const resp = await fetch(`${BASE}/projects`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ name, text }),
  })
  return resp.json()
}

export async function apiGetProject(projectId: number) {
  const resp = await fetch(`${BASE}/projects/${projectId}`, { headers: headers() })
  return resp.json()
}

export async function apiSaveProject(projectId: number, text: string, scriptJson: string) {
  const resp = await fetch(`${BASE}/projects/${projectId}`, {
    method: 'PUT', headers: headers(),
    body: JSON.stringify({ text, script_json: scriptJson }),
  })
  return resp.json()
}

export async function apiDeleteProject(projectId: number) {
  const resp = await fetch(`${BASE}/projects/${projectId}`, {
    method: 'DELETE', headers: headers(),
  })
  return resp.json()
}

// ====== Revisions ======

export async function apiAddRevision(
  projectId: number, action: string, scriptJson: string, chapterCount: number, sceneCount: number,
  chapterNames: string = '',
) {
  const resp = await fetch(`${BASE}/projects/${projectId}/revisions`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ action, script_json: scriptJson, chapter_count: chapterCount, scene_count: sceneCount, chapter_names: chapterNames }),
  })
  return resp.json()
}

export async function apiListRevisions(projectId: number) {
  const resp = await fetch(`${BASE}/projects/${projectId}/revisions`, { headers: headers() })
  return resp.json()
}

// ====== Convert ======

export async function submitConvert(
  text: string, outline?: OutlineResponse, chapterIndices?: number[]
): Promise<ConvertResponse> {
  const resp = await fetch(`${BASE}/convert`, {
    method: 'POST',
    headers: headers(),
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
    headers: headers(),
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
    headers: headers(),
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
    headers: headers(),
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
    headers: headers(),
    body: JSON.stringify({ script, instruction }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(err.detail ?? 'AI 修改失败')
  }
  return resp.json()
}
