import type { Script } from '../types'

interface Props { script: Script }

interface LayoutNode { id: string; name: string; role: string; x: number; y: number; r: number }
interface LayoutEdge { from: string; to: string; label: string }

export default function RelationshipGraph({ script }: Props) {
  const chars = script.characters

  // Collect all edges from character relationships
  const edges: LayoutEdge[] = []
  for (const c of chars) {
    for (const rel of c.relationships || []) {
      // Check target exists
      if (chars.some((ch) => ch.id === rel.target)) {
        edges.push({ from: c.id, to: rel.target, label: rel.relation })
      }
    }
  }

  // Layout: circular, top half for protagonists, bottom for rest
  const W = 700; const H = 520; const cx = W / 2; const cy = H / 2
  const count = chars.length
  const nodes: LayoutNode[] = []

  if (count === 0) {
    return <div className="py-16 text-center text-sm text-warm-gray-light">暂无角色数据</div>
  }

  // Sort: protagonists first
  const sorted = [...chars].sort((a, b) => {
    const o: Record<string, number> = { '主角': 0, '配角': 1, '龙套': 2 }
    return (o[a.role] ?? 1) - (o[b.role] ?? 1)
  })

  const radius = Math.min(220, count * 28)
  for (let i = 0; i < sorted.length; i++) {
    const angle = (i / sorted.length) * Math.PI * 2 - Math.PI / 2
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    const r = sorted[i].role === '主角' ? 26 : sorted[i].role === '配角' ? 20 : 14
    nodes.push({ id: sorted[i].id, name: sorted[i].name, role: sorted[i].role, x, y, r })
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const nodeColors: Record<string, string> = { '主角': '#1e1b18', '配角': '#8b6914', '龙套': '#a8a29e' }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs text-warm-gray">角色关系图谱</h4>
        <div className="flex items-center gap-3 text-[10px] text-warm-gray-light">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-ink"></span>主角</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#8b6914' }}></span>配角</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#a8a29e' }}></span>龙套</span>
        </div>
      </div>

      <div className="border border-border rounded-lg bg-ivory overflow-auto" style={{ maxHeight: 520 }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: W, minHeight: H }}>
          {/* Edge arrows */}
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#c4b5a1" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map((e) => {
            const a = nodeMap.get(e.from); const b = nodeMap.get(e.to)
            if (!a || !b) return null
            // Draw line from a.r to b.r (stop at circle edge)
            const dx = b.x - a.x; const dy = b.y - a.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            const ux = dx / dist; const uy = dy / dist
            const x1 = a.x + ux * (a.r + 2)
            const y1 = a.y + uy * (a.r + 2)
            const x2 = b.x - ux * (b.r + 8)  // arrow gap
            const y2 = b.y - uy * (b.r + 8)
            const mx = (x1 + x2) / 2; const my = (y1 + y2) / 2

            return (
              <g key={`${e.from}-${e.to}`}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d4c8b8" strokeWidth={1.2} markerEnd="url(#arrowhead)" />
                <rect x={mx - e.label.length * 4} y={my - 10} width={e.label.length * 8} height={16} rx={4} fill="#fefdfb" opacity={0.85} />
                <text x={mx} y={my + 1} textAnchor="middle" fill="#a8a29e" fontSize="10" fontFamily="-apple-system, sans-serif">{e.label}</text>
              </g>
            )
          })}

          {/* Nodes */}
          {nodes.map((n) => (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={n.r} fill={nodeColors[n.role] || '#a8a29e'} stroke="#fefdfb" strokeWidth={2.5} />
              <circle cx={n.x} cy={n.y} r={n.r - 4} fill="rgba(255,255,255,0.12)" />
              <text x={n.x} y={n.y + 1} textAnchor="middle" fill="white" fontSize={n.role === '主角' ? 12 : 10.5}
                fontWeight={n.role === '主角' ? 'bold' : 'normal'}
                fontFamily="-apple-system, sans-serif" dominantBaseline="middle">
                {n.name}
              </text>
            </g>
          ))}

          {/* "No relationships" note */}
          {edges.length === 0 && (
            <text x={W / 2} y={H / 2 + 80} textAnchor="middle" fill="#a8a29e" fontSize="12" fontFamily="-apple-system, sans-serif">
              暂无角色关系数据
            </text>
          )}
        </svg>
      </div>
      <p className="text-[10px] text-gray-400 mt-1 text-center">有向箭头表示关系方向（{'>'}目标角色）</p>
    </div>
  )
}
