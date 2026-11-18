import assert from 'node:assert/strict'
import { test } from 'node:test'
import { contextHash } from './hash.ts'
import { lint } from './lint.ts'
import type { Consequence, Decision, Project, Verdict } from './types.ts'

const consequence = (option: string, p: number, reversible = true): Consequence => ({
  option,
  outcome: 'outcome',
  cost: 'time',
  reversible,
  p,
  ifWorks: 1,
  ifFails: 0,
})

function verdict(pick: string, perOption: Consequence[], unknowns: string[] = []): Verdict {
  return {
    pick,
    why: 'because',
    perOption,
    flipIf: 'something',
    unknowns,
    contextHash: '',
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

function project(root: Decision): Project {
  const p: Project = {
    id: 'p',
    name: 'p',
    goal: 'goal',
    root,
    providers: [],
    createdAt: 0,
    updatedAt: 0,
  }
  stamp(p, root)
  return p
}

/** Fill in each verdict's contextHash so freshness checks are deterministic in tests. */
function stamp(p: Project, node: Decision) {
  for (const v of node.verdicts) v.contextHash = contextHash(p, node.id)
  for (const child of node.children) stamp(p, child)
}

const rules = (p: Project) => lint(p).map((f) => f.rule)

test('a clean small tree has no findings', () => {
  const root = node({
    id: 'root',
    state: 'decided',
    choice: 'a',
    rationale: 'because the alternative costs a week more',
    verdicts: [verdict('a', [consequence('a', 0.8), consequence('b', 0.2)])],
  })
  assert.deepEqual(rules(project(root)), [])
})

test('thin rationale and at-risk both fire', () => {
  const root = node({
    id: 'root',
    state: 'decided',
    choice: 'a',
    rationale: 'sure',
    pOverride: 0.3,
    verdicts: [verdict('a', [consequence('a', 0.9), consequence('b', 0.1)])],
  })
  assert.deepEqual(new Set(rules(project(root))), new Set(['thin-rationale', 'at-risk']))
})

test('stale verdict is reported on the spine only', () => {
  const child = node({
    id: 'child',
    state: 'asked',
    via: { kind: 'option', option: 'a' },
    verdicts: [verdict('a', [consequence('a', 0.5), consequence('b', 0.5)])],
  })
  const root = node({
    id: 'root',
    state: 'decided',
    choice: 'a',
    rationale: 'a considered decision made yesterday',
    verdicts: [verdict('a', [consequence('a', 0.8), consequence('b', 0.2)])],
    children: [child],
  })
  const p = project(root)
  child.verdicts[0].contextHash = 'stale-hash'

  assert.ok(rules(p).includes('stale-on-path'))
})

test('diverging models are reported', () => {
  const root = node({
    id: 'root',
    state: 'asked',
    verdicts: [
      verdict('a', [consequence('a', 0.6), consequence('b', 0.4)]),
      { ...verdict('b', [consequence('a', 0.4), consequence('b', 0.6)]), model: 'other' },
    ],
  })
  assert.ok(rules(project(root)).includes('models-diverge'))
})

test('premature children are reported under an undecided parent', () => {
  const root = node({
    id: 'root',
    state: 'open',
    verdicts: [verdict('a', [consequence('a', 0.6), consequence('b', 0.4)], ['growth is steady'])],
    children: [
      node({ id: 'child', question: 'which cloud region', via: { kind: 'option', option: 'a' } }),
    ],
  })
  assert.ok(rules(project(root)).includes('premature'))
})

test('a decision inside an abandoned branch is reported', () => {
  const deadChild = node({
    id: 'dead',
    question: 'which cloud region',
    state: 'decided',
    choice: 'a',
    rationale: 'cheaper by a wide margin here',
    via: { kind: 'option', option: 'b' },
    verdicts: [verdict('a', [consequence('a', 0.9), consequence('b', 0.1)])],
  })
  const root = node({
    id: 'root',
    state: 'decided',
    choice: 'a',
    rationale: 'single box is enough for launch',
    verdicts: [verdict('a', [consequence('a', 0.8), consequence('b', 0.2)])],
    children: [deadChild],
  })
  assert.ok(rules(project(root)).includes('decided-in-dead-branch'))
})

test('promoting an assumption clears the unowned-assumption finding', () => {
  const root = node({
    id: 'root',
    state: 'asked',
    verdicts: [verdict('a', [consequence('a', 0.6), consequence('b', 0.4)], ['growth is steady'])],
    children: [
      node({ id: 'assume', question: 'is growth steady', via: { kind: 'assumption' } }),
    ],
  })
  assert.equal(rules(project(root)).includes('unowned-assumption'), false)
})

test('unowned assumptions are reported when none were promoted', () => {
  const root = node({
    id: 'root',
    state: 'asked',
    verdicts: [verdict('a', [consequence('a', 0.6), consequence('b', 0.4)], ['growth is steady'])],
  })
  assert.ok(rules(project(root)).includes('unowned-assumption'))
})

test('duplicate questions are reported once per pair', () => {
  const root = node({
    id: 'root',
    question: 'Do we need a managed database for launch',
    state: 'decided',
    choice: 'a',
    rationale: 'postgres on one box is enough here',
    verdicts: [verdict('a', [consequence('a', 0.8), consequence('b', 0.2)])],
    children: [
      node({
        id: 'dup',
        question: 'do we need a managed database for launch',
        via: { kind: 'option', option: 'a' },
      }),
    ],
  })
  const findings = lint(project(root)).filter((f) => f.rule === 'duplicate-question')
  assert.equal(findings.length, 1)
})

test('sprawl needs a real tree before it fires', () => {
  const make = (id: string, children: Decision[] = []): Decision =>
    node({
      id,
      state: 'decided',
      choice: 'a',
      rationale: 'decided for a specific reason here',
      verdicts: [verdict('a', [consequence('a', 0.9), consequence('b', 0.1)])],
      children,
    })

  const small = make('root', [make('x')])
  assert.equal(rules(project(small)).includes('sprawl'), false)

  const wide = make('root', [
    make('a1', [make('a1x', [make('deep')])]),
    make('a2', [make('a2x')]),
    make('a3', [make('a3x')]),
  ])
  assert.ok(rules(project(wide)).includes('sprawl'))
})

test('a review date in the past is reported, one in the future is not', () => {
  const root = node({
    id: 'root',
    state: 'decided',
    choice: 'a',
    rationale: 'decided for a specific reason here',
    reviewAt: Date.now() - 1000,
    verdicts: [verdict('a', [consequence('a', 0.9), consequence('b', 0.1)])],
  })
  assert.ok(rules(project(root)).includes('review-due'))

  const later = { ...root, reviewAt: Date.now() + 86_400_000 }
  assert.equal(rules(project(later)).includes('review-due'), false)
})

test('a reviewed decision is no longer due', () => {
  const root = node({
    id: 'root',
    state: 'decided',
    choice: 'a',
    rationale: 'decided for a specific reason here',
    reviewAt: Date.now() - 1000,
    review: { verdict: 'worked', at: Date.now() },
    verdicts: [verdict('a', [consequence('a', 0.9), consequence('b', 0.1)])],
  })
  assert.equal(rules(project(root)).includes('review-due'), false)
})
