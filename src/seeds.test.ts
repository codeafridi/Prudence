import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { SEEDS, seedToProject } from './seeds.ts'
import type { Decision } from './model/types.ts'

/** A seed that points at a non-existent option, or a decided node without a rationale, is a bug. */
function check(node: Decision): string[] {
  const problems: string[] = []

  if (node.children.length > 0) {
    for (const child of node.children) {
      if (!child.via) problems.push(`${child.id} has no via`)
      if (child.via?.kind === 'option' && !node.options.includes(child.via.option)) {
        problems.push(`${child.id} hangs off unknown option "${child.via.option}"`)
      }
    }
  }

  if (node.state === 'decided') {
    if (!node.choice || !node.options.includes(node.choice)) {
      problems.push(`${node.id} is decided without a valid choice`)
    }
    if (!node.rationale || node.rationale.trim().length === 0) {
      problems.push(`${node.id} is decided without a rationale`)
    }
  }

  for (const child of node.children) problems.push(...check(child))
  return problems
}

test('every seed is structurally sound', () => {
  for (const seed of SEEDS) {
    assert.deepEqual(check(seed.root), [], `seed ${seed.id}`)
    assert.ok(seed.root.options.length >= 2, `${seed.id} root needs two options`)
    assert.ok(seed.root.children.length >= 2, `${seed.id} should show the shape`)
  }
})

test('seed ids are unique across seeds', () => {
  const ids = SEEDS.flatMap((seed) => {
    const out: string[] = []
    const walk = (node: Decision) => {
      out.push(node.id)
      node.children.forEach(walk)
    }
    walk(seed.root)
    return out
  })
  assert.equal(new Set(ids).size, ids.length)
})

test('seeds do not carry verdicts — they must work with no API key', () => {
  const walk = (node: Decision): boolean =>
    node.verdicts.length === 0 && node.children.every(walk)
  for (const seed of SEEDS) assert.ok(walk(seed.root), seed.id)
})

test('a seed becomes an independent project each time', () => {
  const seed = SEEDS[0]
  const a = seedToProject(seed)
  const b = seedToProject(seed)
  a.root.question = 'mutated'
  assert.notEqual(b.root.question, 'mutated')
  assert.ok(b.providers.length === 0)
})

test('reading a seed does not throw', () => {
  assert.doesNotThrow(() => readFileSync(new URL('./seeds.ts', import.meta.url), 'utf8'))
})
