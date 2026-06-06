// ====== 剧本 YAML Schema 类型 ======

export interface Relationship {
  target: string
  relation: string
}

export interface Character {
  id: string
  name: string
  role: '主角' | '配角' | '龙套'
  description: string
  traits: string[]
  relationships: Relationship[]
}

export interface Location {
  name: string
  time: string
  description: string
}

export type SceneElement =
  | { type: 'action'; content: string }
  | { type: 'dialogue'; speaker: string; lines: string[]; emotion: string; notes: string }
  | { type: 'transition'; content: string }

export interface Scene {
  scene_number: number
  location: Location
  characters_present: string[]
  elements: SceneElement[]
}

export interface Meta {
  title: string
  original_work: string
  original_author: string
  adapter: string
  version: string
}

export interface Script {
  meta: Meta
  characters: Character[]
  scenes: Scene[]
}

// ====== API 类型 ======

export interface ConvertResponse {
  task_id: string | null
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: number
  chapters: string[]
  script: Script | null
  error: string | null
}
