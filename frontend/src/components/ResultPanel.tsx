import { useState, useEffect } from 'react'
import yaml from 'js-yaml'
import type { Script } from '../types'
import YAMLPreview from './YAMLPreview'
import ScriptPreview from './ScriptPreview'
import SceneCards from './SceneCards'
import { toFountain } from '../utils/fountain'

interface Props { script: Script; onSave?: (script: Script) => void }

type Tab = 'yaml' | 'characters' | 'stats' | 'script' | 'cards'

export default function ResultPanel({ script: initialScript, onSave }: Props) {
  const [tab, setTab] = useState<Tab>('script')
  const [script, setScript] = useState<Script>(initialScript)

  useEffect(() => { setScript(initialScript) }, [initialScript])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'script', label: '剧本预览' },
    { key: 'cards', label: '场景卡片' },
    { key: 'characters', label: '角色表' },
    { key: 'stats', label: '统计' },
    { key: 'yaml', label: 'YAML' },
  ]

  const handleScriptUpdate = (updated: Script) => { setScript(updated); onSave?.(updated) }
  const handleReorder = (scenes: Script['scenes']) => { const u = { ...script, scenes }; setScript(u); onSave?.(u) }

  const handleFountainDownload = () => {
    const text = toFountain(script)
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `${script.meta.title || 'script'}.fountain`
    a.click()
  }

  const handleYamlDownload = () => {
    const yamlString = yaml.dump(script, { indent: 2, lineWidth: -1, noRefs: true, sortKeys: false })
    const blob = new Blob([yamlString], { type: 'text/yaml;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `${script.meta.title || 'script'}.yaml`
    a.click()
  }

  const dialogueCount = script.scenes.flatMap((s) => s.elements).filter((e) => e.type === 'dialogue').length

  return (
    <div className="card-warm p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-lg font-bold text-ink">转换结果</h2>
        <div className="flex items-center gap-2">
          <button onClick={handleFountainDownload} className="text-xs px-2.5 py-1.5 border border-border rounded-lg text-warm-gray hover:text-ink hover:border-warm-gray-light transition-colors">Fountain</button>
          <button onClick={handleYamlDownload} className="text-xs px-2.5 py-1.5 border border-border rounded-lg text-warm-gray hover:text-ink hover:border-warm-gray-light transition-colors">下载 YAML</button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-3 py-2 text-xs whitespace-nowrap transition-colors border-b-2 -mb-px ${tab === key ? 'border-ink text-ink font-medium' : 'border-transparent text-warm-gray-light hover:text-ink'}`}>{label}</button>
        ))}
      </div>

      {tab === 'yaml' && <YAMLPreview script={script} />}

      {tab === 'characters' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {script.characters.map((c) => (
            <div key={c.id} className="p-3 bg-soft-amber/30 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink text-sm">{c.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${c.role === '主角' ? 'bg-ink text-white' : c.role === '配角' ? 'bg-soft-amber text-warm-gray' : 'bg-border text-warm-gray-light'}`}>{c.role}</span>
              </div>
              <p className="text-xs text-warm-gray mt-1">{c.description}</p>
              {c.traits.length > 0 && <div className="flex gap-1 mt-2 flex-wrap">{c.traits.map((t) => <span key={t} className="text-[10px] bg-border/50 text-warm-gray px-1.5 py-0.5 rounded">{t}</span>)}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === 'stats' && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="场景数" value={script.scenes.length.toString()} />
          <StatCard label="角色数" value={script.characters.length.toString()} />
          <StatCard label="对话数" value={dialogueCount.toString()} />
        </div>
      )}

      {tab === 'cards' && <SceneCards script={script} onReorder={handleReorder} />}
      {tab === 'script' && <ScriptPreview script={script} onScriptUpdate={handleScriptUpdate} />}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return <div className="text-center p-4 bg-soft-amber/40 rounded-lg"><div className="text-xl font-bold text-ink font-serif">{value}</div><div className="text-xs text-warm-gray mt-0.5">{label}</div></div>
}
