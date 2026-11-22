import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Decision, Review } from './types.ts'
import { calibration } from './calibration.ts'

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

const reviewed = (verdict: Review['verdict'], p?: number): Review => ({
  verdict,
  at: 1_700_000_000_000,
  ...(p === undefined ? {} : { p }),
})

test('calibration is empty until an outcome exists', () => {
  const cal = calibration(node({ id: 'root', children: [node({ id: 'open' })] }))
  assert.equal(cal.n, 0)
  assert.equal(cal.brier, null)
  assert.deepEqual(cal.buckets, [])
  assert.equal(cal.bias, 0)
})

test('scores worked, failed and mixed calls against their forecasts', () => {
  const root = node({
    id: 'root',
    children: [
      node({ id: 'a', state: 'decided', choice: 'a', pOverride: 0.8, review: reviewed('worked') }),
      node({ id: 'b', state: 'decided', choice: 'a', pOverride: 0.8, review: reviewed('failed') }),
      node({ id: 'c', state: 'decided', choice: 'a', pOverride: 0.4, review: reviewed('mixed') }),
    ],
  })

  const cal = calibration(root)
  assert.equal(cal.n, 3)
  assert.ok(cal.brier !== null)
  assert.ok(Math.abs(cal.brier - 0.23) < 1e-9, `brier ${cal.brier}`)
  assert.ok(Math.abs(cal.meanP - 2 / 3) < 1e-9)
  assert.ok(Math.abs(cal.hitRate - 0.5) < 1e-9)
  assert.ok(cal.bias > 0, 'said more than happened reads as overconfident')

  assert.deepEqual(
    cal.buckets.map((b) => [b.label, b.n, b.said, b.happened]),
    [
      ['under 50', 1, 0.4, 0.5],
      ['80–90', 2, 0.8, 0.5],
    ],
  )
})

test('the review snapshots the forecast so later p edits cannot re-score it', () => {
  const root = node({
    id: 'root',
    children: [
      node({
        id: 'a',
        state: 'decided',
        choice: 'a',
        pOverride: 0.9,
        review: reviewed('worked', 0.6),
      }),
    ],
  })

  const cal = calibration(root)
  assert.equal(cal.n, 1)
  assert.equal(cal.calls[0].p, 0.6)
  assert.ok(cal.brier !== null && Math.abs(cal.brier - 0.16) < 1e-9)
})

test('a review without any forecast is not scored', () => {
  const root = node({
    id: 'root',
    children: [
      node({ id: 'plain', state: 'decided', choice: 'a', review: reviewed('worked') }),
      node({ id: 'scored', state: 'decided', choice: 'a', pOverride: 0.5, review: reviewed('worked') }),
    ],
  })

  const cal = calibration(root)
  assert.equal(cal.n, 1)
  assert.equal(cal.unscored, 1)
  assert.equal(cal.calls[0].id, 'scored')
})

test('a review in a branch you did not take is not scored', () => {
  const root = node({
    id: 'root',
    state: 'decided',
    choice: 'a',
    pOverride: 0.7,
    children: [
      node({
        id: 'chosen',
        state: 'decided',
        choice: 'a',
        via: { kind: 'option', option: 'a' },
        pOverride: 0.7,
        review: reviewed('worked'),
      }),
      node({
        id: 'abandoned',
        state: 'decided',
        choice: 'b',
        via: { kind: 'option', option: 'b' },
        pOverride: 0.9,
        review: reviewed('failed'),
      }),
    ],
  })

  const cal = calibration(root)
  assert.equal(cal.n, 1)
  assert.equal(cal.calls[0].id, 'chosen')
})

test('buckets put boundaries on the right side', () => {
  const root = node({
    id: 'root',
    children: [
      node({ id: 'half', state: 'decided', choice: 'a', pOverride: 0.5, review: reviewed('worked') }),
      node({ id: 'ninety', state: 'decided', choice: 'a', pOverride: 0.9, review: reviewed('worked') }),
      node({ id: 'certain', state: 'decided', choice: 'a', pOverride: 1, review: reviewed('worked') }),
      node({ id: 'low', state: 'decided', choice: 'a', pOverride: 0, review: reviewed('failed') }),
    ],
  })

  const cal = calibration(root)
  assert.deepEqual(
    cal.buckets.map((b) => [b.label, b.n]),
    [
      ['under 50', 1],
      ['50–60', 1],
      ['90+', 2],
    ],
  )
})
