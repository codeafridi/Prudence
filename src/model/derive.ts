import type { Edge, Node } from '@xyflow/react'
import { layout } from '../canvas/layout'
import { decisionFlags, exploredLabel, type DecisionFlags } from './flags'
import { contextHash } from './hash'
import type { Decision, Project } from './types'

/**
 * The only place React Flow nodes/edges are constructed — spec §6.
 * Pure; memoise on `project` in the caller. An edge cannot outlive its node because there is no
 * edge store.
 */

export type DecisionNodeData = {
  decision: Decision
  flags: DecisionFlags
  explored: string
  /** Newest fresh verdict's pick — the handle that glows before you decide (§6). */
  recommended?: string
  /** Has an answer, but the tree changed underneath it (§3). */
  stale: boolean
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

export function derive(project: Project): Derived {
  const entries = flatten(project.root)

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
    })
  }

  const computed = layout(entries, edges)

  const nodes: DecisionNode[] = entries.map(({ decision, parent }) => {
    const latest = decision.verdicts[0]
    const stale = latest !== undefined && latest.contextHash !== contextHash(project, decision.id)
    const recommended = latest && !stale ? latest.pick : undefined

    return {
      id: decision.id,
      type: 'decision',
      // A hand-placed node keeps its position; everything else follows dagre (Tidy clears `pos`).
      position: decision.pos ?? computed[decision.id],
      data: {
        decision,
        flags: decisionFlags(decision, parent),
        explored: exploredLabel(decision),
        stale,
        recommended,
      },
    }
  })

  return { nodes, edges }
}
