import type { Decision, Via } from './types.ts'

/**
 * Pure tree operations — every store mutation goes through these.
 * Immutable: a node (and its ancestors) is copied only when it actually changed, so `===` is a
 * valid "did anything change" test and undo snapshots stay cheap.
 */

export function findNode(root: Decision, id: string): Decision | undefined {
  if (root.id === id) return root
  for (const child of root.children) {
    const hit = findNode(child, id)
    if (hit) return hit
  }
  return undefined
}

export function findParent(root: Decision, id: string): Decision | undefined {
  if (root.children.some((c) => c.id === id)) return root
  for (const child of root.children) {
    const hit = findParent(child, id)
    if (hit) return hit
  }
  return undefined
}

export function updateNode(
  root: Decision,
  id: string,
  fn: (node: Decision) => Decision,
): Decision {
  if (root.id === id) return fn(root)

  let changed = false
  const children = root.children.map((child) => {
    const next = updateNode(child, id, fn)
    if (next !== child) changed = true
    return next
  })
  return changed ? { ...root, children } : root
}

export function removeNode(root: Decision, id: string): Decision {
  const kept = root.children.filter((c) => c.id !== id)
  const children = kept.map((c) => removeNode(c, id))
  const touched = children.some((c, i) => c !== kept[i]) || kept.length !== root.children.length
  return touched ? { ...root, children } : root
}

export function addChild(root: Decision, parentId: string, child: Decision): Decision {
  return updateNode(root, parentId, (parent) => ({
    ...parent,
    children: [...parent.children, child],
  }))
}

export function clearPositions(root: Decision): Decision {
  const { pos: _pos, ...rest } = root
  return { ...rest, children: root.children.map(clearPositions) }
}

export function countNodes(root: Decision): number {
  return 1 + root.children.reduce((sum, child) => sum + countNodes(child), 0)
}

/** An option is removable only when nothing depends on it — spec §4 "Add option" constraint. */
export function canRemoveOption(node: Decision, option: string): boolean {
  if (node.options.length <= 2) return false
  if (node.choice === option) return false
  if (node.children.some((c) => c.via?.kind === 'option' && c.via.option === option)) return false
  if (node.verdicts.some((v) => v.pick === option || v.perOption.some((p) => p.option === option)))
    return false
  return true
}

export function newDecision(via?: Via, question = 'New question'): Decision {
  return {
    id: crypto.randomUUID(),
    question,
    options: ['do', "don't"],
    via,
    state: 'open',
    verdicts: [],
    history: [],
    children: [],
  }
}
