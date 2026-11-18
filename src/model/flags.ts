import { effectiveP } from './ev'
import type { Decision } from './types'

/**
 * Derived, never stored — spec §3.
 * TODO(§3, M3): stale, abandoned, atRisk. They need contextHash, choice chains and effectiveP.
 */
export type DecisionFlags = {
  premature: boolean
  terminal: boolean
  /** Some ancestor chose a different option than the one this branch hangs off (spec §3). */
  abandoned: boolean
  /** Decided, but its assumptions rate it unlikely (backward induction, spec §3). */
  atRisk: boolean
}

export function decisionFlags(
  node: Decision,
  parent?: Decision,
  abandoned = false,
): DecisionFlags {
  return {
    premature: parent !== undefined && parent.state !== 'decided',
    terminal: node.state === 'decided' && node.children.length === 0,
    abandoned,
    atRisk: node.state === 'decided' && effectiveP(node) < 0.5,
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
