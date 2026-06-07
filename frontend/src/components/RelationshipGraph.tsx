import type { Script } from '../types'

interface Props { script: Script }

export default function RelationshipGraph({ script }: Props) {
  const chars = script.characters

  // Collect edges
  const edges: { from: string; to: string; label: string }[] = []
  for (const c of chars) {
    for (const rel of c.relationships || []) {
      if (chars.some((ch) => ch.id === rel.target)) {
        edges.push({ from: c.id, to: rel.target, label: rel.relation })
      }
    }
  }

  if (chars.length === 0) {
    return <div className="py-16 text-center text-sm text-warm-gray-light">暂无角色数据</div>
  }

  // Layout: circular with larger spacing
  const W = 800; const H = 600; const cx = W / 2; const cy = H / 2
  const sorted = [...chars].sort((a, b) => {
    const o: Record<string, number> = { '主角': 0, '配角': 1, '龙套': 2 }
    return (o[a.role] ?? 1) - (o[b.role] ?? 1)
  })

  const count = sorted.length
  const radius = Math.min(280, Math.max(160, count * 26))

  const nodes: { id: string; name: string; role: string; x: number; y: number; r: number }[] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2
    const r = sorted[i].role === '主角' ? 32 : sorted[i].role === '配角' ? 24 : 18
    nodes.push({
      id: sorted[i].id, name: sorted[i].name, role: sorted[i].role,
      x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, r,
    })
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const colors: Record<string, string> = { '主角': '#1e1b18', '配角': '#8b6914', '龙套': '#a8a29e' }

  // Space labels above or below to avoid overlap
  const labelOffsets: Record<string, { dx: number; dy: number }> = {}
  for (let i = 0; i < nodes.length; i++) {
    // Alternate: even indices label below, odd above
    labelOffsets[nodes[i].id] = {
      dx: 0,
      dy: i % 2 === 0 ? nodes[i].r + 14 : -(nodes[i].r + 14),
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs text-warm-gray">角色关系图谱</h4>
        <div className="flex items-center gap-3 text-[10px] text-warm-gray-light">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-ink"></span>主角</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#8b6914' }}></span>配角</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#a8a29e' }}></span>龙套</span>
          <span className="text-warm-gray-light ml-2">{edges.length} 条关系</span>
        </div>
      </div>

      <div className="border border-border rounded-lg bg-ivory overflow-auto" style={{ maxHeight: 600 }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: W, minHeight: H }}>
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#c4b5a1" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map((e, i) => {
            const a = nodeMap.get(e.from); const b = nodeMap.get(e.to)
            if (!a || !b) return null
            const dx = b.x - a.x; const dy = b.y - a.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            const ux = dx / dist; const uy = dy / dist
            const x1 = a.x + ux * a.r
            const y1 = a.y + uy * a.r
            const x2 = b.x - ux * (b.r + 8)
            const y2 = b.y - uy * (b.r + 8)
            const mx = (x1 + x2) / 2; const my = (y1 + y2) / 2

            return (
              <g key={`edge-${i}`}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d4c8b8" strokeWidth={1.2} markerEnd="url(#arrowhead)" />
                <rect x={mx - e.label.length * 7} y={my - 9} width={e.label.length * 14} height={16} rx={4} fill="#fefdfb" opacity={0.9} stroke="#e7e0d8" strokeWidth={0.5} />
                <text x={mx} y={my + 1} textAnchor="middle" fill="#8b6914" fontSize="10" fontFamily="-apple-system, sans-serif">{e.label}</text>
              </g>
            )
          })}

          {/* Nodes */}
          {nodes.map((n) => {
            const off = labelOffsets[n.id]
            return (
              <g key={n.id}>
                <circle cx={n.x} cy={n.y} r={n.r} fill={colors[n.role] || '#a8a29e'} stroke="#fefdfb" strokeWidth={2.5} />
                <circle cx={n.x} cy={n.y} r={n.r - 5} fill="rgba(255,255,255,0.1)" />
                <text x={n.x} y={n.y + 1} textAnchor="middle" fill="white"
                  fontSize={n.role === '主角' ? 12.5 : 11}
                  fontWeight={n.role === '主角' ? 'bold' : 'normal'}
                  fontFamily="-apple-system, sans-serif" dominantBaseline="middle">{n.name}</text>
                {/* Role label below node */}
                <text x={n.x + off.dx} y={n.y + off.dy} textAnchor="middle" fill="#a8a29e"
                  fontSize="9" fontFamily="-apple-system, sans-serif">{n.role}</text>
              </g>
            )
          })}

          {edges.length === 0 && (
            <text x={W / 2} y={H / 2 + 30} textAnchor="middle" fill="#a8a29e" fontSize="13" fontFamily="-apple-system, sans-serif">
              暂无角色关系数据
            </text>
          )}
        </svg>
      </div>
      <p className="text-[10px] text-warm-gray-light mt-1 text-center">箭头方向 = 关系指向，线上文字 = 关系类型</p>
    </div>
  )
}
