import type { Decision } from './types.ts'

/**
 * Node finder — deliberately dumb and synchronous: exact substring beats token hits, and the
 * question plus the chosen option are the two things a person remembers.
 * No embeddings, no index, no dependency (spec §6 deferral note).
 */
export function flattenTree(root: Decision): Decision[] {
  const out: Decision[] = []
  const walk = (node: Decision) => {
    out.push(node)
    for (const child of node.children) walk(child)
  }
  walk(root)
  return out
}

export function scoreNode(node: Decision, query: string): number {
  const q = query.trim().toLowerCase()
  if (!q) return 0

  const question = node.question.toLowerCase()
  const choice = node.choice?.toLowerCase() ?? ''

  if (question.startsWith(q)) return 1000 - question.length
  if (question.includes(q)) return 500 - question.length
  if (choice === q) return 400
  if (choice.includes(q)) return 300

  const tokens = q.split(/\s+/).filter(Boolean)
  const haystack = `${question} ${choice}`
  const matched = tokens.filter((token) => haystack.includes(token)).length
  return matched === 0 ? 0 : matched * 10
}

export function searchNodes(root: Decision, query: string, limit = 8): Decision[] {
  const all = flattenTree(root)
  if (!query.trim()) return all.slice(0, limit)

  return all
    .map((node) => ({ node, score: scoreNode(node, query) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((hit) => hit.node)
}
