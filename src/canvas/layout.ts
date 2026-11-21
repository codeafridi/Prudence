import dagre from 'dagre'
import type { Edge } from '@xyflow/react'
import type { Decision } from '../model/types'

export const NODE_W = 300
export const NODE_H = 150

type Placed = { decision: Decision }

/**
 * dagre, top-down — spec §6. Recompute only on structural change.
 * `shortcut: full dagre every time; fine below ~300 nodes, revisit with ELK if that stops being true.`
 */
export function layout(
  placed: Placed[],
  edges: Edge[],
): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 40 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const { decision } of placed) g.setNode(decision.id, { width: NODE_W, height: NODE_H })
  for (const e of edges) g.setEdge(e.source, e.target)

  dagre.layout(g)

  const out: Record<string, { x: number; y: number }> = {}
  for (const { decision } of placed) {
    const n = g.node(decision.id)
    // dagre gives centres; React Flow wants top-left.
    out[decision.id] = { x: n.x - NODE_W / 2, y: n.y - NODE_H / 2 }
  }
  return out
}
