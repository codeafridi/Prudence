import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  addChild,
  canRemoveOption,
  clearPositions,
  countNodes,
  findNode,
  newDecision,
  removeNode,
  updateNode,
} from './ops.ts'
import type { Decision } from './types.ts'

function tree(): Decision {
  const leaf = { ...newDecision(undefined, 'leaf'), id: 'leaf' }
  const mid = { ...newDecision(undefined, 'mid'), id: 'mid', children: [leaf], pos: { x: 1, y: 2 } }
  return { ...newDecision(undefined, 'root'), id: 'root', options: ['a', 'b', 'c'], children: [mid], pos: { x: 0, y: 0 } }
}

test('updateNode copies only the changed path', () => {
  const root = tree()
  const next = updateNode(root, 'leaf', (n) => ({ ...n, question: 'renamed' }))
  assert.notEqual(next, root)
  assert.equal(findNode(next, 'leaf')?.question, 'renamed')
  assert.equal(next.pos, root.pos)
})

test('updateNode returns the same tree when the id is absent', () => {
  const root = tree()
  assert.equal(updateNode(root, 'nope', (n) => n), root)
})

test('removeNode drops the whole subtree and leaves siblings alone', () => {
  const root = tree()
  const next = removeNode(root, 'mid')
  assert.equal(findNode(next, 'mid'), undefined)
  assert.equal(findNode(next, 'leaf'), undefined, 'descendant must go too')
  assert.equal(countNodes(next), 1)
  assert.equal(next.children.length, 0)
})

test('addChild attaches under the right parent', () => {
  const root = tree()
  const child = newDecision({ kind: 'option', option: 'a' }, 'child')
  const next = addChild(root, 'mid', child)
  assert.equal(findNode(next, 'mid')?.children.length, 2)
  assert.equal(countNodes(next), 4)
})

test('canRemoveOption refuses options something depends on', () => {
  const root = tree()
  const withChild = addChild(root, 'root', newDecision({ kind: 'option', option: 'a' }))
  const node = findNode(withChild, 'root')!
  assert.equal(canRemoveOption(node, 'a'), false, 'has a child on this option')
  assert.equal(canRemoveOption(node, 'b'), true, 'nothing depends on it')
  assert.equal(canRemoveOption(node, 'c'), true)
})

test('canRemoveOption refuses to drop below two options', () => {
  const node = { ...newDecision(), options: ['do', "don't"] }
  assert.equal(canRemoveOption(node, 'do'), false)
})

test('clearPositions keeps the structure, drops every pos', () => {
  const next = clearPositions(tree())
  assert.equal(next.pos, undefined)
  assert.equal(findNode(next, 'mid')?.pos, undefined)
  assert.equal(countNodes(next), 3)
})
