import type { Decision, Project } from './types.ts'

/**
 * contextHash — spec §5.3.
 *
 * Deviation from the spec's "sha256": WebCrypto is async, and staleness is evaluated during
 * render, so this is a synchronous 64-bit FNV-1a over a canonical string. It detects change, not
 * an attacker — nothing security-relevant depends on it.
 */
const OFFSET = 0xcbf29ce484222325n
const PRIME = 0x100000001b3n
const MASK = 0xffffffffffffffffn

function fnv1a(input: string): string {
  let hash = OFFSET
  for (let i = 0; i < input.length; i++) {
    hash = ((hash ^ BigInt(input.charCodeAt(i))) * PRIME) & MASK
  }
  return hash.toString(16).padStart(16, '0')
}

/** Root → node, inclusive. Empty when the node is not in this tree. */
export function pathTo(root: Decision, id: string): Decision[] {
  if (root.id === id) return [root]
  for (const child of root.children) {
    const path = pathTo(child, id)
    if (path.length > 0) return [root, ...path]
  }
  return []
}

/** Goal, ancestors' question/options/choice, and this node's question/options. Nothing else. */
export function contextHash(project: Project, nodeId: string): string {
  const path = pathTo(project.root, nodeId)
  if (path.length === 0) return ''

  const node = path[path.length - 1]
  const ancestors = path.slice(0, -1)

  return fnv1a(
    JSON.stringify({
      goal: project.goal,
      path: ancestors.map((a) => [a.question, a.options, a.choice ?? null]),
      node: [node.question, node.options],
    }),
  )
}

export function isFresh(project: Project, node: Decision): boolean {
  const newest = node.verdicts[0]
  if (!newest) return false
  return newest.contextHash === contextHash(project, node.id)
}
