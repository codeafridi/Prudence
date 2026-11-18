import assert from 'node:assert/strict'
import { test } from 'node:test'
import { effectiveP, ev, pOf, recommendedPath } from './ev.ts'
import type { Consequence, Decision, Verdict } from './types.ts'

const consequence = (option: string, p: number, ifWorks: number, ifFails: number): Consequence => ({
  option,
  outcome: 'outcome',
  cost: 'time',
  reversible: true,
  p,
  ifWorks,
  ifFails,
})

function verdict(pick: string, perOption: Consequence[]): Verdict {
  return {
    pick,
    why: 'because',
    perOption,
    flipIf: 'something',
    unknowns: [],
    contextHash: 'x',
    model: 'test',
    tokens: { in: 1, out: 1 },
    at: 0,
  }
}

function node(partial: Partial<Decision> & { id: string }): Decision {
  return {
    question: partial.id,
    options: ['a', 'b'],
    state: 'open',
    verdicts: [],
    history: [],
    children: [],
    ...partial,
  }
}

test('ev is p*ifWorks + (1-p)*ifFails', () => {
  assert.equal(ev(consequence('a', 0.5, 3, -1)), 1)
  assert.equal(ev(consequence('a', 1, -2, 0)), -2)
})

test('pOverride beats the model and only applies to a decided node', () => {
  const decided = node({
    id: 'n',
    state: 'decided',
    choice: 'a',
    verdicts: [verdict('a', [consequence('a', 0.9, 1, 0), consequence('b', 0.1, 1, 0)])],
  })
  assert.equal(pOf(decided), 0.9)
  assert.equal(pOf({ ...decided, pOverride: 0.3 }), 0.3)
  assert.equal(pOf({ ...decided, state: 'open' }), 1)
})

test('effectiveP multiplies only live decided requirement children', () => {
  const abandoned = node({
    id: 'abandoned',
    state: 'decided',
    choice: 'a',
    pOverride: 0.1,
    via: { kind: 'option', option: 'b' },
    verdicts: [verdict('a', [consequence('a', 0.1, 1, 0)])],
  })
  const open = node({
    id: 'open',
    state: 'open',
    pOverride: 0.1,
    via: { kind: 'option', option: 'a' },
  })
  const live = node({
    id: 'live',
    state: 'decided',
    choice: 'a',
    pOverride: 0.5,
    via: { kind: 'option', option: 'a' },
    verdicts: [verdict('a', [consequence('a', 0.5, 1, 0)])],
  })
  const parent = node({
    id: 'parent',
    state: 'decided',
    choice: 'a',
    pOverride: 0.8,
    verdicts: [verdict('a', [consequence('a', 0.8, 1, 0)])],
    children: [abandoned, open, live],
  })

  assert.equal(effectiveP(parent), 0.8 * 0.5)
})

test('recommendedPath follows the higher-value live branch', () => {
  const richChild = node({
    id: 'rich',
    state: 'decided',
    choice: 'a',
    via: { kind: 'option', option: 'a' },
    verdicts: [verdict('a', [consequence('a', 1, 3, 0)])],
  })
  const poorChild = node({
    id: 'poor',
    state: 'decided',
    choice: 'a',
    via: { kind: 'option', option: 'a' },
    verdicts: [verdict('a', [consequence('a', 1, 0, -3)])],
  })
  const root = node({
    id: 'root',
    state: 'decided',
    choice: 'a',
    verdicts: [verdict('a', [consequence('a', 1, 1, 0)])],
    children: [poorChild, richChild],
  })

  assert.deepEqual(recommendedPath(root), ['root', 'rich'])
})

test('recommendedPath skips branches under an option that was not chosen', () => {
  const dead = node({
    id: 'dead',
    state: 'decided',
    choice: 'a',
    via: { kind: 'option', option: 'b' },
    verdicts: [verdict('a', [consequence('a', 1, 9, 0)])],
  })
  const root = node({
    id: 'root',
    state: 'decided',
    choice: 'a',
    verdicts: [verdict('a', [consequence('a', 1, 1, 0)])],
    children: [dead],
  })

  assert.deepEqual(recommendedPath(root), ['root'])
})

test('a lone node is its own path', () => {
  assert.deepEqual(recommendedPath(node({ id: 'solo' })), ['solo'])
})
