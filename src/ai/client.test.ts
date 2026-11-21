import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { askVerdict, parseJson, pickTier, ProviderError } from './client.ts'
import type { Decision } from '../model/types.ts'

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

const VALID = {
  pick: 'a',
  why: 'cheaper',
  perOption: [
    { option: 'a', outcome: 'works', cost: 'time', reversible: true, p: 0.7, ifWorks: 2, ifFails: -1 },
    { option: 'b', outcome: 'costs more', cost: 'money', reversible: false, p: 0.3, ifWorks: 1, ifFails: -2 },
  ],
  flipIf: 'traffic spikes',
  unknowns: [],
}

function reply(content: string, status = 200): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }),
    { status, headers: { 'Content-Type': 'application/json' } },
  )
}

const input = {
  provider: { baseUrl: 'http://localhost:9/v1', model: 'test', apiKey: 'k' },
  messages: [{ role: 'user' as const, content: 'q' }],
  options: ['a', 'b'],
}

test('falls through the ladder and succeeds on a later format', async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return calls < 3 ? reply('Sure! Here is my analysis: a is better.') : reply(JSON.stringify(VALID))
  }

  const result = await askVerdict(input)
  assert.equal(result.verdict.pick, 'a')
  assert.equal(calls, 3, 'json_schema, json_object, then inline')
  assert.deepEqual(result.tokens, { in: 10, out: 5 })
})

test('repairs once when every format returns unusable JSON', async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return calls <= 3 ? reply('{"nope": true}') : reply(JSON.stringify(VALID))
  }

  const result = await askVerdict(input)
  assert.equal(result.verdict.pick, 'a')
  assert.equal(calls, 4, 'three attempts plus one repair turn')
})

test('gives up instead of inventing a verdict', async () => {
  globalThis.fetch = async () => reply('{"nope": true}')
  await assert.rejects(() => askVerdict(input), /No usable answer/)
})

test('a 401 fails immediately rather than trying every format', async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return new Response('invalid key', { status: 401 })
  }

  await assert.rejects(
    () => askVerdict(input),
    (error) => error instanceof ProviderError && error.status === 401,
  )
  assert.equal(calls, 1)
})

test('an unreachable endpoint fails once and names CORS instead of "Failed to fetch"', async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    throw new TypeError('Failed to fetch')
  }

  await assert.rejects(
    () => askVerdict(input),
    (error) =>
      error instanceof ProviderError &&
      error.status === 0 &&
      /could not reach/.test(error.message) &&
      /CORS/.test(error.message),
  )
  assert.equal(calls, 1, 'no format retries against a host the browser cannot reach')
})

test('parseJson survives fences and chatter around the object', () => {
  assert.deepEqual(parseJson('```json\n{"a":1}\n```'), { a: 1 })
  assert.deepEqual(parseJson('here you go {"a":2} hope that helps'), { a: 2 })
  assert.throws(() => parseJson('no object here'))
})

function node(partial: Partial<Decision>): Decision {
  return {
    id: 'n',
    question: 'q',
    options: ['a', 'b'],
    state: 'open',
    verdicts: [],
    history: [],
    children: [],
    ...partial,
  }
}

test('stakes routing goes deep for irreversible options', () => {
  const reversible = node({
    state: 'asked',
    verdicts: [
      {
        pick: 'a',
        why: 'w',
        perOption: [
          { option: 'a', outcome: 'o', cost: 'time', reversible: true, p: 0.8, ifWorks: 1, ifFails: 0 },
          { option: 'b', outcome: 'o', cost: 'time', reversible: true, p: 0.2, ifWorks: 1, ifFails: 0 },
        ],
        flipIf: 'f',
        unknowns: [],
        contextHash: 'h',
        model: 'm',
        tokens: { in: 0, out: 0 },
        at: 0,
      },
    ],
  })

  assert.equal(pickTier(reversible), 'cheap')
  const oneWay = structuredClone(reversible)
  oneWay.verdicts[0].perOption[1].reversible = false
  assert.equal(pickTier(oneWay), 'deep')
  assert.equal(pickTier(node({})), 'cheap', 'no verdict yet means cheap first')
})
