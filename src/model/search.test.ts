import assert from 'node:assert/strict'
import { test } from 'node:test'
import { searchNodes } from './search.ts'
import type { Decision } from './types.ts'

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

const root = node({
  id: 'root',
  question: 'Do we need multi-server before launch?',
  children: [
    node({ id: 'db', question: 'Do we need a managed database?' }),
    node({ id: 'cloud', question: 'AWS or Azure?', state: 'decided', choice: 'Azure' }),
    node({ id: 'ci', question: 'Which CI provider?', state: 'decided', choice: 'GitHub Actions' }),
  ],
})

test('exact prefix beats a mid-string hit', () => {
  const hits = searchNodes(root, 'do we need')
  assert.equal(hits.length, 2)
  assert.ok(hits.every((hit) => hit.question.toLowerCase().startsWith('do we need')))
})

test('mid-string hits are found', () => {
  assert.deepEqual(
    searchNodes(root, 'managed').map((hit) => hit.id),
    ['db'],
  )
})

test('the chosen option is searchable', () => {
  assert.deepEqual(
    searchNodes(root, 'azure').map((hit) => hit.id),
    ['cloud'],
  )
})

test('multi-token queries match loosely', () => {
  const hits = searchNodes(root, 'ci provider')
  assert.equal(hits[0].id, 'ci')
})

test('empty query returns the first nodes, no query returns nothing useful', () => {
  assert.equal(searchNodes(root, '   ').length, 4)
  assert.deepEqual(searchNodes(root, 'zzz'), [])
})

test('results are capped', () => {
  assert.ok(searchNodes(root, 'e', 2).length <= 2)
})
