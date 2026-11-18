import type { Edge, Node } from '@xyflow/react'
import { layout } from '../canvas/layout'
import { decisionFlags, exploredLabel, type DecisionFlags } from './flags'
import type { Decision } from './types'

/**
 * The only place React Flow nodes/edges are constructed — spec §6.
 * Pure; memoise on `root` in the caller. An edge cannot outlive its node because there is no edge store.
 */

export type DecisionNodeData = {
  decision: Decision
  flags: DecisionFlags
  explored: string
}

export type DecisionNode = Node<DecisionNodeData>

export type Derived = { nodes: DecisionNode[]; edges: Edge[] }

type Entry = { decision: Decision; parent?: Decision }

function flatten(root: Decision): Entry[] {
  const out: Entry[] = []
  const walk = (decision: Decision, parent?: Decision) => {
    out.push({ decision, parent })
    for (const child of decision.children) walk(child, decision)
  }
  walk(root)
  return out
}

export function derive(root: Decision): Derived {
  const entries = flatten(root)

  const edges: Edge[] = []
  for (const { decision, parent } of entries) {
    if (!parent || !decision.via) continue
    const via = decision.via
    const handleId =
      via.kind === 'option' ? String(parent.options.indexOf(via.option)) : 'assumption'
    edges.push({
      id: decision.id,
      source: parent.id,
      sourceHandle: handleId,
      target: decision.id,
      type: 'smoothstep',
      label: via.kind === 'option' ? via.option : 'assumed',
      // TODO(§6, M3): style by abandoned / atRisk
    })
  }

  const computed = layout(entries, edges)

  const nodes: DecisionNode[] = entries.map(({ decision, parent }) => ({
    id: decision.id,
    type: 'decision',
    // A hand-placed node keeps its position; everything else follows dagre (Tidy clears `pos`).
    position: decision.pos ?? computed[decision.id],
    data: {
      decision,
      flags: decisionFlags(decision, parent),
      explored: exploredLabel(decision),
    },
  }))

  return { nodes, edges }
}
