/** Convert Script to Fountain screenplay format */

import type { Script } from '../types'

export function toFountain(script: Script): string {
  const lines: string[] = []
  const charMap = new Map(script.characters.map((c) => [c.id, c.name]))

  // Title page
  lines.push(`Title: ${script.meta.title || 'Untitled'}`)
  lines.push(`Credit: Adapted from "${script.meta.original_work}"`)
  if (script.meta.adapter) lines.push(`Author: ${script.meta.adapter}`)
  lines.push(`Draft date: ${new Date().toISOString().slice(0, 10)}`)
  lines.push('')
  lines.push('===')

  for (const scene of script.scenes) {
    const loc = scene.location
    // Scene heading
    lines.push('')
    lines.push(`.${loc.name} - ${loc.time}`)
    if (loc.description) lines.push(loc.description)
    lines.push('')

    for (const el of scene.elements) {
      if (el.type === 'action') {
        lines.push(el.content)
        lines.push('')
      } else if (el.type === 'dialogue') {
        const name = charMap.get(el.speaker) || el.speaker
        lines.push(name.toUpperCase())
        if (el.emotion) lines.push(`(${el.emotion})`)
        for (const line of el.lines) {
          lines.push(line)
        }
        lines.push('')
      } else if (el.type === 'transition') {
        lines.push(`> ${el.content}`)
        lines.push('')
      }
    }
  }

  return lines.join('\n')
}
