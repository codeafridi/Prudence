import type { Decision } from './types'

/** Deterministic findings — spec §6.5, milestone M3. No AI, no key, no tokens. */
export type Finding = {
  rule:
    | 'unowned-assumption'
    | 'irreversible-and-open'
    | 'thin-rationale'
    | 'premature'
    | 'models-diverge'
    | 'stale-on-path'
    | 'decided-in-dead-branch'
    | 'at-risk'
    | 'sprawl'
    | 'duplicate-question'
  nodeId: string
  detail: string
}

export function lint(_root: Decision): Finding[] {
  throw new Error('lint — spec §6.5, milestone M3')
}
