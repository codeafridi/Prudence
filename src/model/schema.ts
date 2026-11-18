import { z } from 'zod'
import type { Consequence } from './types.ts'

/**
 * The AI's side of the contract — spec §5.4.
 * Hard reject: pick outside the node's options, an option with no consequence row, empty text,
 * out-of-range numbers. Soft trim: long prose is cut, because a long answer that renders is worse
 * than a short one that reads.
 */

export const MAX_WHY_WORDS = 25
export const MAX_OUTCOME_WORDS = 20

const consequenceSchema = z.object({
  option: z.string().min(1),
  outcome: z.string().min(1),
  cost: z.enum(['time', 'money', 'complexity', 'none']),
  reversible: z.boolean(),
  p: z.number().min(0).max(1),
  ifWorks: z.number().min(-3).max(3),
  ifFails: z.number().min(-3).max(3),
})

const verdictBodySchema = z.object({
  pick: z.string().min(1),
  why: z.string().min(1),
  perOption: z.array(consequenceSchema).min(1),
  flipIf: z.string().min(1),
  unknowns: z.array(z.string()).default([]),
})

export type ParsedVerdict = {
  pick: string
  why: string
  perOption: Consequence[]
  flipIf: string
  unknowns: string[]
}

export type ParseResult = { ok: true; verdict: ParsedVerdict } | { ok: false; error: string }

export function parseVerdict(options: string[], input: unknown): ParseResult {
  const parsed = verdictBodySchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; '),
    }
  }

  const body = parsed.data

  if (!options.includes(body.pick)) {
    return { ok: false, error: `pick "${body.pick}" is not one of: ${options.join(' | ')}` }
  }

  const missing = options.filter((option) => !body.perOption.some((c) => c.option === option))
  if (missing.length > 0) {
    return { ok: false, error: `perOption is missing: ${missing.join(' | ')}` }
  }

  return {
    ok: true,
    verdict: {
      ...body,
      why: capWords(body.why, MAX_WHY_WORDS),
      perOption: body.perOption.map((c) => ({
        ...c,
        outcome: capWords(c.outcome, MAX_OUTCOME_WORDS),
      })),
    },
  }
}

function capWords(text: string, max: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= max) return text.trim()
  return `${words.slice(0, max).join(' ')}…`
}

/** Sent as `response_format.json_schema` — OpenAI strict mode requires every field listed. */
export const verdictJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['pick', 'why', 'perOption', 'flipIf', 'unknowns'],
  properties: {
    pick: { type: 'string', description: 'exactly one of the given options' },
    why: { type: 'string', description: 'at most 25 words' },
    perOption: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['option', 'outcome', 'cost', 'reversible', 'p', 'ifWorks', 'ifFails'],
        properties: {
          option: { type: 'string' },
          outcome: { type: 'string', description: 'at most 20 words' },
          cost: { type: 'string', enum: ['time', 'money', 'complexity', 'none'] },
          reversible: { type: 'boolean' },
          p: { type: 'number', minimum: 0, maximum: 1 },
          ifWorks: { type: 'integer', minimum: -3, maximum: 3 },
          ifFails: { type: 'integer', minimum: -3, maximum: 3 },
        },
      },
    },
    flipIf: { type: 'string', description: 'the single fact that would change the pick' },
    unknowns: {
      type: 'array',
      items: { type: 'string' },
      description: 'facts the model had to assume; not restatements of the question',
    },
  },
} as const
