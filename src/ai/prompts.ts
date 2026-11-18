import type { Decision, Project } from '../model/types'

/** Prompt assembly — spec §5.2. The ancestor chain is the quality lever; nothing else is sent. */
export function buildAsk(_project: Project, _node: Decision): string {
  throw new Error('buildAsk — spec §5.2, milestone M2')
}

/** Derivation, not brainstorming — spec §5.2: what must be true for the chosen option to work? */
export function buildExpand(_project: Project, _node: Decision): string {
  throw new Error('buildExpand — spec §5.2, milestone M4')
}
