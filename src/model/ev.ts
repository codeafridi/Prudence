import type { Consequence, Decision } from './types'

/**
 * Ranking only. Never printed as a precise number, never exported (§2, §12).
 */
export const ev = (c: Consequence): number => c.p * c.ifWorks + (1 - c.p) * c.ifFails

/**
 * Backward induction over the tree — spec §3, milestone M3.
 * effectiveP(node) = pOf(node) × Π effectiveP(decided requirement children)
 */
export function effectiveP(_node: Decision): number {
  throw new Error('effectiveP — spec §3, milestone M3')
}

/** Max-sum chain root → leaf by ev — spec §6, milestone M4. */
export function recommendedPath(_root: Decision): string[] {
  throw new Error('recommendedPath — spec §6, milestone M4')
}
