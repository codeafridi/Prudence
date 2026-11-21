import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderRecordHTML } from './html.ts'
import type { Decision, Project } from '../model/types.ts'

const decided = (overrides: Partial<Decision> = {}): Decision => ({
  id: 'root',
  question: 'Do we ship the single box?',
  options: ['do', "don't"],
  state: 'decided',
  choice: 'do',
  rationale: 'One box is enough until demand is proven.',
  decidedAt: Date.UTC(2026, 10, 3),
  pOverride: 0.8,
  verdicts: [
    {
      pick: 'do',
      why: 'Notes users fit one box.',
      perOption: [
        { option: 'do', outcome: 'works', cost: 'time', reversible: true, p: 0.8, ifWorks: 3, ifFails: -1 },
        { option: "don't", outcome: 'waits', cost: 'none', reversible: true, p: 0.2, ifWorks: 0, ifFails: 0 },
      ],
      flipIf: 'Uptime SLA appears.',
      unknowns: ['Growth stays under 2k users'],
      contextHash: 'abc',
      model: 'test',
      tokens: { in: 1, out: 1 },
      at: Date.UTC(2026, 10, 2),
    },
  ],
  history: [],
  children: [
    {
      id: 'child',
      question: 'Which host? <script>alert(1)</script>',
      options: ['fly', 'hetzner'],
      via: { kind: 'option', option: 'do' },
      state: 'open',
      verdicts: [],
      history: [],
      children: [],
    },
  ],
  ...overrides,
})

const project = (root: Decision): Project => ({
  id: 'p1',
  name: 'Notes app <beta>',
  goal: 'Ship a notes app people can trust.',
  root,
  providers: [],
  createdAt: Date.UTC(2026, 10, 1),
  updatedAt: Date.UTC(2026, 10, 3),
})

test('renders a standalone document with the record header', () => {
  const html = renderRecordHTML(project(decided()), { now: new Date(Date.UTC(2026, 10, 22)) })

  assert.match(html, /^<!doctype html>/)
  assert.match(html, /<title>Notes app &lt;beta&gt; — decision record<\/title>/)
  assert.match(html, /Subject of record/)
  assert.match(html, /Entries 2/)
  assert.match(html, /Filed 1/)
  assert.match(html, /Printed 2026-11-22/)
})

test('keeps clause numbers and the chosen option mark', () => {
  const html = renderRecordHTML(project(decided()))

  assert.match(html, /<span class="clause">1<\/span>/)
  assert.match(html, /<span class="clause">1\.1<\/span>/)
  assert.match(html, /class="chosen"><span class="mark">●<\/span><span class="opt">do<\/span><span class="p">p \.80<\/span>/)
  assert.match(html, /<span class="mark">○<\/span><span class="opt">don&#39;t<\/span>/)
})

test('escapes user text everywhere', () => {
  const html = renderRecordHTML(project(decided()))

  assert.ok(!html.includes('<script>alert(1)</script>'))
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.match(html, /Notes app &lt;beta&gt;/)
})

test('stamps the state, date and rationale', () => {
  const html = renderRecordHTML(project(decided()))

  assert.match(html, /class="stamp filed">Filed · 2026-11-03/)
  assert.match(html, /Rationale/)
  assert.match(html, /One box is enough until demand is proven\./)
  assert.match(html, /Why/)
  assert.match(html, /Flip if/)
  assert.match(html, /Assumed/)
  assert.match(html, /class="stamp open">Open</)
  assert.match(html, /Under “do”/)
})

test('includes a review and a premortem when they exist', () => {
  const root = decided({
    premortem: {
      reasons: [{ why: 'Traffic spikes past one box', likelihood: 'medium' }],
      at: Date.UTC(2026, 10, 3),
      model: 'test',
    },
    review: { verdict: 'worked', note: 'Held at 1.4k users', at: Date.UTC(2026, 11, 1) },
  })
  const html = renderRecordHTML(project(root))

  assert.match(html, /Premortem/)
  assert.match(html, /Traffic spikes past one box/)
  assert.match(html, /Outcome · 2026-12-01/)
  assert.match(html, /review-worked/)
})

test('embeds fonts as data urls and never links out', () => {
  const html = renderRecordHTML(project(decided()), {
    fonts: { serif: 'AAAA', mono: 'BBBB' },
  })

  assert.match(html, /url\(data:font\/woff2;base64,AAAA\)/)
  assert.match(html, /url\(data:font\/woff2;base64,BBBB\)/)
  assert.ok(!/https?:\/\//.test(html), 'the file must not reference the network')
})

test('carries print rules', () => {
  const html = renderRecordHTML(project(decided()))

  assert.match(html, /@page\{size:A4/)
  assert.match(html, /break-inside:avoid/)
  assert.match(html, /@media print/)
  assert.match(html, /window\.print\(\)/)
})

test('marks the branch that was not taken', () => {
  const root = decided({
    children: [
      {
        id: 'left',
        question: 'Branch we took',
        options: ['a', 'b'],
        via: { kind: 'option', option: 'do' },
        state: 'open',
        verdicts: [],
        history: [],
        children: [],
      },
      {
        id: 'right',
        question: 'Branch we did not take',
        options: ['a', 'b'],
        via: { kind: 'option', option: "don't" },
        state: 'open',
        verdicts: [],
        history: [],
        children: [],
      },
    ],
  })
  const html = renderRecordHTML(project(root))

  assert.match(html, /class="entry abandoned"/)
  assert.match(html, /Branch not taken/)
  assert.ok(!html.includes('<li class="entry abandoned">\n  <div class="head">\n    <span class="clause">1.1'))
})

test('an empty child does not invent a verdict', () => {
  const html = renderRecordHTML(project(decided()))
  const childSection = html.slice(html.indexOf('<span class="clause">1.1</span>'))

  assert.ok(!childSection.includes('class="stamp filed"'))
  assert.ok(!childSection.includes('class="p"'))
})
