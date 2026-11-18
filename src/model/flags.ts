import type { Decision } from './types'

/**
 * Derived, never stored — spec §3.
 * TODO(§3, M3): stale, abandoned, atRisk. They need contextHash, choice chains and effectiveP.
 */
export type DecisionFlags = {
  premature: boolean
  terminal: boolean
}

export function decisionFlags(node: Decision, parent?: Decision): DecisionFlags {
  return {
    premature: parent !== undefined && parent.state !== 'decided',
    terminal: node.state === 'decided' && node.children.length === 0,
  }
}

/** `2 / 5 explored` — distinct options of this node that have children. */
export function exploredLabel(node: Decision): string {
  const explored = new Set<string>()
  for (const child of node.children) {
    if (child.via?.kind === 'option') explored.add(child.via.option)
  }
  return `${explored.size} / ${node.options.length} explored`
}
