import { effectiveP } from '../model/ev.ts'
import type { Decision } from '../model/types.ts'
import {
  parseVerdict,
  verdictJsonSchema,
  type ParsedVerdict,
} from '../model/schema.ts'

/**
 * OpenAI-compatible adapter — spec §5.1. One code path covers OpenRouter, OpenAI, Groq, vLLM,
 * Ollama and LM Studio. The fallback ladder exists because providers disagree about structured
 * output; the Zod parse (§5.4) is the only thing that decides whether a verdict is usable.
 */

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export type ProviderCredentials = {
  baseUrl: string
  model: string
  apiKey: string
}

export type AskInput = {
  provider: ProviderCredentials
  messages: ChatMessage[]
  options: string[]
  signal?: AbortSignal
}

export type AskResult = {
  verdict: ParsedVerdict
  model: string
  tokens: { in: number; out: number }
}

export class ProviderError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ProviderError'
    this.status = status
  }
}

const INLINE_SCHEMA =
  'Return only a JSON object: {"pick":string,"why":string,"perOption":' +
  '[{"option":string,"outcome":string,"cost":"time|money|complexity|none",' +
  '"reversible":boolean,"p":number,"ifWorks":number,"ifFails":number}],' +
  '"flipIf":string,"unknowns":string[]}'

type Format = Record<string, unknown> | undefined

function attempts(messages: ChatMessage[]): { messages: ChatMessage[]; format: Format }[] {
  return [
    {
      messages,
      format: { type: 'json_schema', json_schema: { name: 'verdict', strict: true, schema: verdictJsonSchema } },
    },
    { messages, format: { type: 'json_object' } },
    { messages: [...messages, { role: 'user', content: INLINE_SCHEMA }], format: undefined },
  ]
}

export async function askVerdict(input: AskInput): Promise<AskResult> {
  const { provider, messages, options, signal } = input
  let lastError = 'no attempt was made'
  let invalid: string | undefined

  for (const attempt of attempts(messages)) {
    try {
      const response = await complete(provider, attempt.messages, attempt.format, signal)
      const parsed = parseVerdict(options, parseJson(response.content))
      if (parsed.ok) {
        return { verdict: parsed.verdict, model: provider.model, tokens: response.tokens }
      }
      lastError = parsed.error
      invalid = response.content
    } catch (error) {
      // A bad key or a missing model will not be fixed by trying a different response format.
      if (error instanceof ProviderError && (error.status === 401 || error.status === 403)) throw error
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  // One repair turn: hand the model its own invalid output plus the reason it was rejected.
  if (invalid) {
    const repaired = await complete(
      provider,
      [
        ...messages,
        { role: 'assistant', content: invalid },
        { role: 'user', content: `That JSON was invalid: ${lastError}. Return only the corrected JSON object.` },
      ],
      undefined,
      signal,
    )
    const parsed = parseVerdict(options, parseJson(repaired.content))
    if (parsed.ok) {
      return { verdict: parsed.verdict, model: provider.model, tokens: repaired.tokens }
    }
    lastError = parsed.error
  }

  throw new Error(`No usable verdict from ${provider.model}: ${lastError}`)
}

type CompleteResult = { content: string; tokens: { in: number; out: number } }

type WireResponse = {
  choices?: { message?: { content?: string } }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

async function complete(
  provider: ProviderCredentials,
  messages: ChatMessage[],
  format: Format,
  signal?: AbortSignal,
): Promise<CompleteResult> {
  const url = `${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`

  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages,
      temperature: 0.2,
      ...(format ? { response_format: format } : {}),
    }),
  })

  if (!response.ok) {
    throw new ProviderError(response.status, `${response.status} ${(await response.text()).slice(0, 300)}`)
  }

  const body = (await response.json()) as WireResponse
  return {
    content: body.choices?.[0]?.message?.content ?? '',
    tokens: {
      in: body.usage?.prompt_tokens ?? 0,
      out: body.usage?.completion_tokens ?? 0,
    },
  }
}

export function parseJson(content: string): unknown {
  const text = content.trim()
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end > start) return JSON.parse(text.slice(start, end + 1))
    throw new Error('model returned no JSON object')
  }
}

/**
 * Stakes routing — spec §4. Spend the expensive model where you cannot undo the answer.
 * `irreversible` is the trigger, not `cost`: nearly every option costs something, so costing
 * something cannot be what earns a bigger model.
 */
export function pickTier(node: Decision): 'cheap' | 'deep' {
  const verdict = node.verdicts[0]
  const irreversible = verdict?.perOption.some((c) => !c.reversible) ?? false
  const shaky = node.state === 'decided' && effectiveP(node) < 0.5
  return irreversible || shaky ? 'deep' : 'cheap'
}
