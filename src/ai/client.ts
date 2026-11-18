import { effectiveP } from '../model/ev.ts'
import {
  expandJsonSchema,
  grillJsonSchema,
  parseExpand,
  parseGrill,
  parsePremortem,
  premortemJsonSchema,
  parseVerdict,
  verdictJsonSchema,
  type ParsedGrill,
  type ParsedVerdict,
} from '../model/schema.ts'
import type { Decision } from '../model/types.ts'

/**
 * OpenAI-compatible adapter — spec §5.1. One code path covers OpenRouter, OpenAI, Groq, vLLM,
 * Ollama and LM Studio. The fallback ladder exists because providers disagree about structured
 * output; the Zod parse (§5.4) is the only thing that decides whether an answer is usable.
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

export function askVerdict(input: AskInput): Promise<AskResult> {
  return requestJson({
    provider: input.provider,
    messages: input.messages,
    signal: input.signal,
    schema: verdictJsonSchema,
    inline:
      'Return only a JSON object: {"pick":string,"why":string,"perOption":' +
      '[{"option":string,"outcome":string,"cost":"time|money|complexity|none",' +
      '"reversible":boolean,"p":number,"ifWorks":number,"ifFails":number}],' +
      '"flipIf":string,"unknowns":string[]}',
    parse: (raw) => {
      const parsed = parseVerdict(input.options, raw)
      return parsed.ok ? { ok: true, value: parsed.verdict } : parsed
    },
  }).then((result) => ({ verdict: result.value, model: result.model, tokens: result.tokens }))
}

export function askGrill(input: {
  provider: ProviderCredentials
  messages: ChatMessage[]
  signal?: AbortSignal
}): Promise<{ counter: ParsedGrill; model: string; tokens: { in: number; out: number } }> {
  return requestJson({
    provider: input.provider,
    messages: input.messages,
    signal: input.signal,
    schema: grillJsonSchema,
    inline: 'Return only a JSON object: {"why":string (max 40 words),"flipIf":string}',
    parse: parseGrill,
  }).then((result) => ({ counter: result.value, model: result.model, tokens: result.tokens }))
}

export function askExpand(input: {
  provider: ProviderCredentials
  messages: ChatMessage[]
  signal?: AbortSignal
}): Promise<{ questions: string[]; model: string; tokens: { in: number; out: number } }> {
  return requestJson({
    provider: input.provider,
    messages: input.messages,
    signal: input.signal,
    schema: expandJsonSchema,
    inline: 'Return only a JSON object: {"questions":string[]} — at most 3 questions, no answers.',
    parse: parseExpand,
  }).then((result) => ({ questions: result.value.questions, model: result.model, tokens: result.tokens }))
}

export function askPremortem(input: {
  provider: ProviderCredentials
  messages: ChatMessage[]
  signal?: AbortSignal
}): Promise<{
  reasons: { why: string; likelihood: 'low' | 'medium' | 'high' }[]
  model: string
}> {
  return requestJson({
    provider: input.provider,
    messages: input.messages,
    signal: input.signal,
    schema: premortemJsonSchema,
    inline:
      'Return only a JSON object: {"reasons":[{"why":string (max 25 words),"likelihood":"low|medium|high"}]} — at most 3.',
    parse: parsePremortem,
  }).then((result) => ({ reasons: result.value.reasons, model: result.model }))
}

type ParseOutcome<T> = { ok: true; value: T } | { ok: false; error: string }

type JsonTask<T> = {
  provider: ProviderCredentials
  messages: ChatMessage[]
  schema: unknown
  inline: string
  parse: (input: unknown) => ParseOutcome<T>
  signal?: AbortSignal
}

type Attempt = { messages: ChatMessage[]; format: Record<string, unknown> | undefined }

function attempts(task: JsonTask<unknown>): Attempt[] {
  return [
    {
      messages: task.messages,
      format: { type: 'json_schema', json_schema: { name: 'answer', strict: true, schema: task.schema } },
    },
    { messages: task.messages, format: { type: 'json_object' } },
    { messages: [...task.messages, { role: 'user', content: task.inline }], format: undefined },
  ]
}

async function requestJson<T>(
  task: JsonTask<T>,
): Promise<{ value: T; model: string; tokens: { in: number; out: number } }> {
  let lastError = 'no attempt was made'
  let invalid: string | undefined

  for (const attempt of attempts(task)) {
    try {
      const response = await complete(task.provider, attempt.messages, attempt.format, task.signal)
      const parsed = task.parse(parseJson(response.content))
      if (parsed.ok) return { value: parsed.value, model: task.provider.model, tokens: response.tokens }
      lastError = parsed.error
      invalid = response.content
    } catch (error) {
      // A bad key or a missing model will not be fixed by a different response format.
      if (error instanceof ProviderError && (error.status === 401 || error.status === 403)) throw error
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  // One repair turn: hand the model its own invalid output plus the reason it was rejected.
  if (invalid) {
    const repaired = await complete(
      task.provider,
      [
        ...task.messages,
        { role: 'assistant', content: invalid },
        { role: 'user', content: `That JSON was invalid: ${lastError}. Return only the corrected JSON object.` },
      ],
      undefined,
      task.signal,
    )
    const parsed = task.parse(parseJson(repaired.content))
    if (parsed.ok) {
      return { value: parsed.value, model: task.provider.model, tokens: repaired.tokens }
    }
    lastError = parsed.error
  }

  throw new Error(`No usable answer from ${task.provider.model}: ${lastError}`)
}

type CompleteResult = { content: string; tokens: { in: number; out: number } }

type WireResponse = {
  choices?: { message?: { content?: string } }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

async function complete(
  provider: ProviderCredentials,
  messages: ChatMessage[],
  format: Record<string, unknown> | undefined,
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
