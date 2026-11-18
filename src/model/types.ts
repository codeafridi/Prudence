/**
 * Domain model — spec §2. The tree here is the only source of truth.
 * The canvas is a pure projection of it (model/derive.ts); React Flow nodes are never stored.
 */

export type Cost = 'time' | 'money' | 'complexity' | 'none'

export type Consequence = {
  option: string // matches the node's options entry
  outcome: string // ≤20 words
  cost: Cost
  reversible: boolean
  p: number // 0..1 — AI proposes, human overrides via Decision.pOverride
  ifWorks: number // -3..3 ordinal impact
  ifFails: number // -3..3 ordinal impact
}

export type Counter = { why: string; flipIf: string } // output of Grill

export type Verdict = {
  pick: string
  why: string // ≤25 words
  perOption: Consequence[]
  flipIf: string
  unknowns: string[] // each is one click from becoming a node
  counter?: Counter
  contextHash: string // §5.3
  model: string
  tokens: { in: number; out: number }
  at: number
}

/** Why a node exists under its parent. Absent on the root. */
export type Via =
  | { kind: 'option'; option: string } // requirement of choosing that option (§5.2 Expand)
  | { kind: 'assumption' } // promoted from a verdict's `unknowns[]`

export type DecisionState = 'open' | 'asked' | 'decided' | 'parked'

export type Decision = {
  id: string
  question: string
  options: string[] // default ['do', "don't"]; min 2
  via?: Via
  state: DecisionState
  choice?: string // one of options; human only
  rationale?: string // required when decided
  decidedAt?: number // set by Decide; the export uses it for the retrospective date
  pOverride?: number // human's p for `choice`, beats the AI's
  verdicts: Verdict[] // newest first
  history: { choice: string; rationale: string; pOverride?: number; at: number }[]
  children: Decision[]
  pos?: { x: number; y: number } // survives re-layout when dragged
}

export type Provider = {
  id: string
  label: string
  baseUrl: string // e.g. https://openrouter.ai/api/v1
  model: string
  tier: 'cheap' | 'deep' // stakes routing, §4
  // API keys are NOT stored here — §7.2
}

export type Project = {
  id: string
  name: string
  goal: string // header text, injected into every prompt, never a node
  root: Decision
  providers: Provider[]
  createdAt: number
  updatedAt: number
}

export const SCHEMA_VERSION = 1
