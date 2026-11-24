import assert from 'node:assert/strict'
import { test } from 'node:test'
import { highlightSegments } from './highlight.ts'

test('marks every occurrence case-insensitively', () => {
  assert.deepEqual(highlightSegments('Do we need pricing? Pricing!', 'PRICING'), [
    { text: 'Do we need ', match: false },
    { text: 'pricing', match: true },
    { text: '? ', match: false },
    { text: 'Pricing', match: true },
    { text: '!', match: false },
  ])
})

test('marks every token in a multi-word query', () => {
  assert.deepEqual(highlightSegments('Decide the pricing model', 'decide model'), [
    { text: 'Decide', match: true },
    { text: ' the pricing ', match: false },
    { text: 'model', match: true },
  ])
})

test('treats regex characters in the query as text', () => {
  assert.deepEqual(highlightSegments('Use C++ or c++?', 'C++'), [
    { text: 'Use ', match: false },
    { text: 'C++', match: true },
    { text: ' or ', match: false },
    { text: 'c++', match: true },
    { text: '?', match: false },
  ])
})

test('returns one plain segment for an empty query', () => {
  assert.deepEqual(highlightSegments('Decide the pricing model', '  '), [
    { text: 'Decide the pricing model', match: false },
  ])
})

test('returns one plain segment when nothing matches', () => {
  assert.deepEqual(highlightSegments('Decide the pricing model', 'hiring'), [
    { text: 'Decide the pricing model', match: false },
  ])
})
