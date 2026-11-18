import type { Decision } from './types'

/** contextHash — spec §5.3, milestone M2. Staleness depends on this, so it is not optional. */
export function contextHash(_root: Decision, _node: Decision): string {
  throw new Error('contextHash — spec §5.3, milestone M2')
}
