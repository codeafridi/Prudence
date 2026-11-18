import type { Edge, Node } from '@xyflow/react'
import { layout } from '../canvas/layout'
import { recommendedPath } from './ev'
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
  /** Sits on the max-sum chain recommendedPath() picked (§6). */
  onPath: boolean
}

export type DecisionNode = Node<DecisionNodeData>

export type Derived = { nodes: DecisionNode[]; edges: Edge[] }

type Entry = { decision: Decision; parent?: Decision; abandoned: boolean }

function flatten(root: Decision): Entry[] {
  const out: Entry[] = []
  const walk = (decision: Decision, parent?: Decision, abandoned = false) => {
    out.push({ decision, parent, abandoned })
    for (const child of decision.children) {
      const childAbandoned =
        abandoned ||
        (decision.state === 'decided' &&
          child.via?.kind === 'option' &&
          child.via.option !== decision.choice)
      walk(child, decision, childAbandoned)
    }
  }
  walk(root)
  return out
}

function truncateLabel(text: string, max = 24): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

export function derive(project: Project): Derived {
  const entries = flatten(project.root)
  const path = new Set(recommendedPath(project.root))

  const edges: Edge[] = []
  for (const { decision, parent, abandoned } of entries) {
    if (!parent || !decision.via) continue
    const via = decision.via
    const handleId =
      via.kind === 'option' ? String(parent.options.indexOf(via.option)) : 'assumption'
    const onPath = path.has(decision.id) && path.has(parent.id)

    edges.push({
      id: decision.id,
      source: parent.id,
      sourceHandle: handleId,
      target: decision.id,
      type: 'smoothstep',
      label: truncateLabel(
        via.kind === 'option' ? via.option : via.kind === 'risk' ? 'risk' : 'assumed',
      ),
      labelStyle: { fill: abandoned ? '#52525b' : '#a1a1aa', fontSize: 10 },
      labelBgStyle: { fill: '#0b0b0d', fillOpacity: 0.85 },
      labelBgPadding: [3, 2] as [number, number],
      style: abandoned
        ? { stroke: '#3f3f46', strokeDasharray: '4 4', opacity: 0.5 }
        : onPath
          ? { stroke: '#34d399', strokeWidth: 1.8 }
          : { stroke: '#52525b' },
    })
  }

  const computed = layout(entries, edges)

  const nodes: DecisionNode[] = entries.map(({ decision, parent, abandoned }) => {
    const latest = decision.verdicts[0]
    const stale = latest !== undefined && latest.contextHash !== contextHash(project, decision.id)
    const recommended = latest && !stale ? latest.pick : undefined

    return {
      id: decision.id,
      type: 'decision',
      // A hand-placed node keeps its position; everything else follows dagre (Tidy clears `pos`).
      position: decision.pos ?? computed[decision.id],
      style: { opacity: abandoned ? 0.45 : 1 },
      data: {
        decision,
        flags: decisionFlags(decision, parent, abandoned),
        explored: exploredLabel(decision),
        stale,
        recommended,
        onPath: path.has(decision.id),
      },
    }
  })

  return { nodes, edges }
}
