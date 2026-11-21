import type { Decision } from './types'

/**
 * Clause numbers, derived — never stored. A filed record numbers itself: 1, 1.1, 1.2, 1.2.1.
 * The root is always 1; children take their index under the parent.
 */
export function clauseNumbers(root: Decision): Map<string, string> {
  const out = new Map<string, string>()
  const walk = (node: Decision, prefix: string) => {
    out.set(node.id, prefix)
    node.children.forEach((child, i) => walk(child, `${prefix}.${i + 1}`))
  }
  walk(root, '1')
  return out
}
