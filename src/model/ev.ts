import type { Consequence, Decision, Verdict } from './types.ts'

/**
 * Ranking only — never printed as a precise number, never exported (spec §2, §12).
 * `p` comes from the model and is badly calibrated, so ev exists to order options,
 * not to claim a value.
 */
export const ev = (c: Consequence): number => c.p * c.ifWorks + (1 - c.p) * c.ifFails

/** Human's estimate wins over the model's (spec §2). Falls back to the newest verdict. */
export function pOf(node: Decision): number {
  if (node.state !== 'decided' || !node.choice) return 1
  if (node.pOverride !== undefined) return node.pOverride
  // No estimate is no information, not a coin flip: returning 0.5 here would make an unasked
  // tree drift into "at risk" purely by multiplication.
  return consequenceFor(node, node.choice)?.p ?? 1
}

/** True when a probability actually exists on the record (human override or model estimate). */
export function hasForecast(node: Decision): boolean {
  if (node.state !== 'decided' || !node.choice) return false
  return node.pOverride !== undefined || consequenceFor(node, node.choice) !== undefined
}

function consequenceFor(node: Decision, option: string): Consequence | undefined {
  return node.verdicts[0]?.perOption.find((c) => c.option === option)
}

/**
 * Backward induction, one bottom-up pass — spec §3.
 * effectiveP(node) = pOf(node) × Π effectiveP(live decided requirement children)
 *
 * "Live" is load-bearing: a child on an option you did not choose is abandoned, and an open
 * child has no estimate yet. Neither may drag the parent down.
 */
export function effectiveP(node: Decision): number {
  if (node.state !== 'decided' || !node.choice) return 1

  const live = node.children.filter(
    (child) =>
      child.state === 'decided' &&
      child.via?.kind === 'option' &&
      child.via.option === node.choice,
  )

  return live.reduce((p, child) => p * effectiveP(child), pOf(node))
}

/** What a node is worth on its own: ev of the chosen option, or of the model's pick. */
function nodeValue(node: Decision): number {
  const best: Verdict | undefined = node.verdicts[0]
  if (!best) return 0

  if (node.state === 'decided' && node.choice) {
    const consequence = best.perOption.find((c) => c.option === node.choice)
    return consequence ? ev({ ...consequence, p: pOf(node) }) : 0
  }

  if (node.state === 'asked') {
    const consequence = best.perOption.find((c) => c.option === best.pick)
    return consequence ? ev(consequence) : 0
  }

  return 0
}

/**
 * Max-sum chain root → leaf — spec §6 ("your best route is these six decisions").
 * `shortcut: re-scores subtrees at every level, O(n·depth); fine under ~300 nodes.`
 */
export function recommendedPath(root: Decision): string[] {
  const candidates =
    root.state === 'decided' && root.choice
      ? root.children.filter((c) => c.via?.kind === 'option' && c.via.option === root.choice)
      : root.children

  let bestChain: string[] = []
  let bestScore = Number.NEGATIVE_INFINITY

  for (const child of candidates) {
    const chain = recommendedPath(child)
    const score = chain.reduce((sum, id) => {
      const node = walk(root, id)
      return sum + (node ? nodeValue(node) : 0)
    }, 0)
    if (score > bestScore) {
      bestScore = score
      bestChain = chain
    }
  }

  return [root.id, ...bestChain]
}

function walk(root: Decision, id: string): Decision | undefined {
  if (root.id === id) return root
  for (const child of root.children) {
    const hit = walk(child, id)
    if (hit) return hit
  }
  return undefined
}
