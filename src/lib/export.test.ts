import assert from 'node:assert/strict'
import { test } from 'node:test'
import { contextHash } from '../model/hash.ts'
import type { Consequence, Decision, Project, Verdict } from '../model/types.ts'
import { exportJson, exportMarkdown } from './export.ts'

const consequence = (option: string, p: number): Consequence => ({
  option,
  outcome: 'outcome',
  cost: 'time',
  reversible: true,
  p,
  ifWorks: 1,
  ifFails: 0,
})

function verdict(pick: string, options: string[], unknowns: string[] = []): Verdict {
  return {
    pick,
    why: 'because',
    perOption: options.map((o) => consequence(o, 0.5)),
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

function fixture(): Project {
  const rejected = node({
    id: 'rejected',
    question: 'AWS or Azure?',
    options: ['AWS', 'Azure'],
    state: 'open',
    via: { kind: 'option', option: 'b' },
  })
  const chosen = node({
    id: 'chosen',
    question: 'Do we need a managed database?',
    state: 'open',
    via: { kind: 'option', option: 'a' },
  })
  const root = node({
    id: 'root',
    question: 'Do we need multi-server before 1k users?',
    options: ['a', 'b'],
    state: 'decided',
    choice: 'a',
    rationale: 'one box is enough until far past launch',
    decidedAt: Date.UTC(2026, 10, 18),
    pOverride: 0.8,
    verdicts: [verdict('a', ['a', 'b'], ['growth stays linear'])],
    children: [chosen, rejected],
  })

  const project: Project = {
    id: 'p',
    name: 'Notes app',
    goal: 'ship a notes app for 1k users',
    root,
    providers: [
      { label: 'x', baseUrl: 'https://x', model: 'm', tier: 'cheap', apiKey: 'sk-secret' } as never,
    ],
    createdAt: 0,
    updatedAt: 0,
  }
  stamp(project, root)
  return project
}

function stamp(project: Project, node: Decision) {
  for (const v of node.verdicts) v.contextHash = contextHash(project, node.id)
  for (const child of node.children) stamp(project, child)
}

test('markdown carries the decided line, rationale, human p and date', () => {
  const md = exportMarkdown(fixture())
  assert.match(md, /# Notes app — decision log/)
  assert.match(md, /\*\*Decided:\*\* a — 2026-11-18/)
  assert.match(md, /> one box is enough/)
  assert.match(md, /p 0\.50 → you 0\.80/)
  assert.match(md, /assumed growth stays linear/)
})

test('the branch you did not take is a collapsed footnote', () => {
  const md = exportMarkdown(fixture())
  assert.match(md, /<details><summary>rejected: b — AWS or Azure\?<\/summary>/)
  assert.match(md, /1 rejected branch/)
  assert.doesNotMatch(md, /^### AWS or Azure\?/m, 'rejected branch is not a main section')
})

test('undecided children on the chosen path are marked open', () => {
  const md = exportMarkdown(fixture())
  assert.match(md, /### Do we need a managed database\?/)
  assert.match(md, /\*\*Open\*\* — not decided yet/)
})

test('stats count decisions and closure', () => {
  const md = exportMarkdown(fixture())
  assert.match(md, /3 decisions · 0\/1 closed without children \(0%\)/)
})

test('json export strips api keys', () => {
  const json = exportJson(fixture())
  assert.doesNotMatch(json, /sk-secret/)
  assert.doesNotMatch(json, /"apiKey"/i)
  assert.match(json, /"question": "Do we need multi-server before 1k users\?"/)
})
