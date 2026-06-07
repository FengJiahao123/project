import { useEffect, useRef, useState } from 'react'
import type { Script } from '../types'

interface Props {
  script: Script
}

interface Node {
  id: string
  name: string
  role: string
  x: number
  y: number
  r: number
  color: string
  vx: number
  vy: number
}

interface Edge {
  from: string
  to: string
  label: string
}

const ROLE_COLORS: Record<string, string> = {
  '主角': '#1e1b18',
  '配角': '#8b6914',
  '龙套': '#a8a29e',
}

const ROLE_RADIUS: Record<string, number> = {
  '主角': 28,
  '配角': 22,
  '龙套': 16,
}

function buildGraph(script: Script) {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const chars = script.characters

  // Circular initial layout
  const count = chars.length
  const cx = 320; const cy = 280; const radius = Math.min(220, count * 22)

  for (let i = 0; i < count; i++) {
    const c = chars[i]
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2
    const x = cx + Math.cos(angle) * radius + (Math.random() - 0.5) * 20
    const y = cy + Math.sin(angle) * radius + (Math.random() - 0.5) * 20
    const role = c.role || '龙套'
    nodes.push({
      id: c.id, name: c.name, role,
      x, y,
      r: ROLE_RADIUS[role] || 18,
      color: ROLE_COLORS[role] || '#a8a29e',
      vx: 0, vy: 0,
    })
    for (const rel of c.relationships || []) {
      edges.push({ from: c.id, to: rel.target, label: rel.relation })
    }
  }
  return { nodes, edges }
}

export default function RelationshipGraph({ script }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState('')
  const nodesRef = useRef<Map<string, Node>>(new Map())
  const edgesRef = useRef<Edge[]>([])
  const animRef = useRef<number>(0)
  const mouseRef = useRef<{ x: number; y: number; down: boolean; node: string | null }>({ x: 0, y: 0, down: false, node: null })

  useEffect(() => {
    const { nodes, edges } = buildGraph(script)
    if (nodes.length === 0) { setError('暂无角色数据'); return }
    nodesRef.current = new Map()
    for (const n of nodes) nodesRef.current.set(n.id, n)
    edgesRef.current = edges
    animate()
    return () => cancelAnimationFrame(animRef.current)
  }, [script])

  const animate = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const nodes = nodesRef.current
    const edges = edgesRef.current
    const w = canvas.width; const h = canvas.height

    // Force simulation — simple repulsion + attraction
    const nodeArr = [...nodes.values()]
    const centerForce = 0.001; const repulsion = 800; const damping = 0.85

    for (const n of nodeArr) {
      // Center pull
      n.vx += (w / 2 - n.x) * centerForce
      n.vy += (h / 2 - n.y) * centerForce
    }

    // Repulsion between all pairs
    for (let i = 0; i < nodeArr.length; i++) {
      for (let j = i + 1; j < nodeArr.length; j++) {
        const dx = nodeArr[i].x - nodeArr[j].x
        const dy = nodeArr[i].y - nodeArr[j].y
        const dist = Math.sqrt(dx * dx + dy * dy) + 1
        const force = repulsion / (dist * dist)
        const fx = dx / dist * force; const fy = dy / dist * force
        nodeArr[i].vx += fx; nodeArr[i].vy += fy
        nodeArr[j].vx -= fx; nodeArr[j].vy -= fy
      }
    }

    // Edge spring attraction
    for (const e of edges) {
      const a = nodes.get(e.from); const b = nodes.get(e.to)
      if (!a || !b) continue
      const dx = b.x - a.x; const dy = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy) + 1
      const force = (dist - 80) * 0.001
      const fx = dx / dist * force; const fy = dy / dist * force
      a.vx += fx; a.vy += fy
      b.vx -= fx; b.vy -= fy
    }

    // Drag
    const mouse = mouseRef.current
    if (mouse.down && mouse.node && nodes.has(mouse.node)) {
      const n = nodes.get(mouse.node)!
      n.x = mouse.x; n.y = mouse.y; n.vx = 0; n.vy = 0
    }

    // Apply velocity
    for (const n of nodeArr) {
      n.vx *= damping; n.vy *= damping
      n.x += n.vx; n.y += n.vy
      n.x = Math.max(n.r, Math.min(w - n.r, n.x))
      n.y = Math.max(n.r, Math.min(h - n.r, n.y))
    }

    // Draw
    ctx.clearRect(0, 0, w, h)

    // Edge lines
    for (const e of edges) {
      const a = nodes.get(e.from); const b = nodes.get(e.to)
      if (!a || !b) continue
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.strokeStyle = '#e7e0d8'
      ctx.lineWidth = 1
      ctx.stroke()
      // Label at midpoint
      const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2
      ctx.fillStyle = '#a8a29e'
      ctx.font = '10px -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(e.label, mx, my - 4)
    }

    // Nodes
    for (const n of nodeArr) {
      // Circle
      ctx.beginPath()
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
      ctx.fillStyle = n.color
      ctx.fill()
      ctx.strokeStyle = '#fefdfb'
      ctx.lineWidth = 2
      ctx.stroke()

      // Inner highlight
      ctx.beginPath()
      ctx.arc(n.x, n.y, n.r - 4, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.fill()

      // Name text
      ctx.fillStyle = '#ffffff'
      ctx.font = n.role === '主角' ? 'bold 12px -apple-system, sans-serif' : '11px -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(n.name, n.x, n.y)
    }

    animRef.current = requestAnimationFrame(animate)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left; const y = e.clientY - rect.top
    mouseRef.current = { x, y, down: true, node: null }
    // Hit test
    for (const [id, n] of nodesRef.current) {
      const dx = n.x - x; const dy = n.y - y
      if (dx * dx + dy * dy < n.r * n.r) {
        mouseRef.current.node = id; break
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    mouseRef.current.x = e.clientX - rect.left
    mouseRef.current.y = e.clientY - rect.top
  }

  const handleMouseUp = () => {
    mouseRef.current.down = false
    mouseRef.current.node = null
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs text-warm-gray">角色关系图谱（可拖拽）</h4>
        <div className="flex items-center gap-3 text-[10px] text-warm-gray-light">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-ink"></span>主角</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:'#8b6914'}}></span>配角</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:'#a8a29e'}}></span>龙套</span>
        </div>
      </div>
      {error ? (
        <p className="text-xs text-warm-gray-light py-8 text-center">{error}</p>
      ) : (
        <canvas
          ref={canvasRef}
          width={640}
          height={560}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full border border-border rounded-lg bg-ivory cursor-grab active:cursor-grabbing"
        />
      )}
      <p className="text-[10px] text-warm-gray-light mt-1 text-center">可拖拽角色节点，关系线自动跟随</p>
    </div>
  )
}
