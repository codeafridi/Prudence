import type { Verdict } from '../model/types'

export type AskRequest = {
  baseUrl: string
  apiKey: string
  model: string
  messages: { role: 'system' | 'user'; content: string }[]
  options: string[] // the node's options — the verdict is validated against these
}

/**
 * OpenAI-compatible adapter — spec §5.1, milestone M2.
 * Fallback ladder (§5.1) lives here: json_schema → json_object → inline schema → one repair turn.
 * A verdict that fails §5.4 validation is never returned.
 */
export async function askVerdict(_req: AskRequest): Promise<Verdict> {
  throw new Error('askVerdict — spec §5, milestone M2')
}

/** Stakes routing — spec §4: deep when irreversible / costly / atRisk / pinned, cheap otherwise. */
export function pickTier(_node: import('../model/types').Decision): 'cheap' | 'deep' {
  throw new Error('pickTier — spec §4, milestone M2')
}
