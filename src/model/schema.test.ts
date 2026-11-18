import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseVerdict } from './schema.ts'

const valid = {
  pick: 'a',
  why: 'cheaper and reversible',
  perOption: [
    { option: 'a', outcome: 'works', cost: 'time', reversible: true, p: 0.7, ifWorks: 2, ifFails: -1 },
    { option: 'b', outcome: 'fails', cost: 'money', reversible: false, p: 0.3, ifWorks: 1, ifFails: -2 },
  ],
  flipIf: 'traffic ten times higher on day one',
  unknowns: ['growth stays linear'],
}

test('a well-formed verdict passes', () => {
  const result = parseVerdict(['a', 'b'], valid)
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.verdict.pick, 'a')
})

test('pick outside the node options is rejected', () => {
  const result = parseVerdict(['a', 'b'], { ...valid, pick: 'c' })
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /not one of/)
})

test('a missing perOption row is rejected', () => {
  const result = parseVerdict(['a', 'b', 'c'], valid)
  assert.equal(result.ok, false)
  if (!result.ok) assert.match(result.error, /missing: c/)
})

test('out-of-range numbers are rejected', () => {
  const broken = {
    ...valid,
    perOption: [{ ...valid.perOption[0], p: 1.4 }, valid.perOption[1]],
  }
  assert.equal(parseVerdict(['a', 'b'], broken).ok, false)
})

test('long prose is trimmed to the caps instead of breaking layout', () => {
  const longWhy = Array.from({ length: 40 }, (_, i) => `w${i}`).join(' ')
  const longOutcome = Array.from({ length: 30 }, (_, i) => `o${i}`).join(' ')
  const result = parseVerdict(['a', 'b'], {
    ...valid,
    why: longWhy,
    perOption: [{ ...valid.perOption[0], outcome: longOutcome }, valid.perOption[1]],
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.verdict.why.split(/\s+/).length, 25, 'capped, ellipsis attached')
  assert.ok(result.verdict.why.endsWith('…'))
  assert.equal(result.verdict.perOption[0].outcome.split(/\s+/).length, 20)
})

test('unknowns defaults to an empty list', () => {
  const { unknowns: _drop, ...withoutUnknowns } = valid
  const result = parseVerdict(['a', 'b'], withoutUnknowns)
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.verdict.unknowns, [])
})
