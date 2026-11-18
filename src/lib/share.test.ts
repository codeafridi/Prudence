import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decodeProject, encodeProject, isProject, readShareHash, shareUrl } from './share.ts'
import type { Project } from '../model/types.ts'

function fixture(): Project {
  return {
    id: 'p1',
    name: 'Notes app',
    goal: 'ship a notes app for 1k users',
    providers: [],
    createdAt: 1620000000000,
    updatedAt: 1620000000000,
    root: {
      id: 'root',
      question: 'Do we need multi-server before 1k users?',
      options: ['no', 'yes'],
      state: 'decided',
      choice: 'no',
      rationale: 'one box is enough until far past launch',
      decidedAt: 1620000000000,
      verdicts: [],
      history: [],
      children: [
        {
          id: 'child',
          question: 'Do we need a managed database?',
          options: ['do', "don't"],
          via: { kind: 'option', option: 'no' },
          state: 'open',
          verdicts: [],
          history: [],
          children: [],
        },
      ],
    },
  }
}

test('a project survives the round trip', async () => {
  const encoded = await encodeProject(fixture())
  const decoded = await decodeProject(encoded)
  assert.deepEqual(decoded, fixture())
})

test('the encoded form is url safe', async () => {
  const encoded = await encodeProject(fixture())
  assert.match(encoded, /^[zj][A-Za-z0-9_-]+$/)
})

test('compression is used when the platform has it', async () => {
  const encoded = await encodeProject(fixture())
  assert.equal(encoded[0], 'z')
})

test('garbage decodes to undefined instead of throwing', async () => {
  assert.equal(await decodeProject('znot-base64!!'), undefined)
  assert.equal(await decodeProject('xnope'), undefined)
  assert.equal(await decodeProject(''), undefined)
})

test('a payload that is not a project is rejected', async () => {
  const json = Buffer.from(JSON.stringify({ v: 1, project: { id: 'x' } })).toString('base64url')
  assert.equal(await decodeProject(`j${json}`), undefined)
})

test('the hash reader only accepts our prefix', () => {
  assert.equal(readShareHash('#p=zabc'), 'zabc')
  assert.equal(readShareHash('#p='), undefined)
  assert.equal(readShareHash('#other'), undefined)
})

test('share urls keep the hash out of the path', async () => {
  const url = await shareUrl(fixture(), { origin: 'https://example.com', pathname: '/prudence/' })
  assert.ok(url.startsWith('https://example.com/prudence/#p=z'))
})

test('isProject rejects a two-optionless root', () => {
  assert.equal(isProject({ id: 'p', goal: 'g', providers: [], root: { id: 'r', question: 'q', options: ['a'], children: [] } }), false)
})
