import { pOf } from '../model/ev.ts'
import { pathTo } from '../model/hash.ts'
import type { Decision, Project, Verdict } from '../model/types.ts'
import type { ChatMessage } from './client.ts'

const SYSTEM = [
  'You are a decision advisor for a project.',
  'Answer only with the requested JSON object.',
  'Judge only the options you are given; never add options.',
  'Keep "why" under 25 words and each "outcome" under 20.',
  'Give "p" as an honest probability that the option works out, and "ifWorks"/"ifFails" as',
  'ordinal impact on a -3..3 scale. Do not imply false precision.',
  'Put every fact you had to assume into "unknowns" — never invent project facts.',
  'If the question cannot be answered without a fact you do not have, say so in "unknowns"',
  'rather than guessing.',
].join(' ')

/**
 * Prompt assembly — spec §5.2. The ancestor chain is the quality lever: it stops a verdict
 * contradicting decisions already made above it, and carries `p` so the model knows how shaky
 * its footing already is. Nothing else from the project is sent.
 */
export function buildAsk(project: Project, node: Decision): ChatMessage[] {
  const path = pathTo(project.root, node.id)
  const ancestors = path.slice(0, -1)

  const lines =
    ancestors.length === 0
      ? ['(none — this is the first decision)']
      : ancestors.map((a) => {
          if (a.state === 'decided' && a.choice) {
            return `- ${a.question} → decided: "${a.choice}" (p ${pOf(a).toFixed(2)})`
          }
          return `- ${a.question} → parked`
        })

  const user = [
    `GOAL: ${project.goal}`,
    '',
    'PATH TO THIS DECISION:',
    ...lines,
    '',
    `QUESTION: ${node.question}`,
    `OPTIONS: ${node.options.join(' | ')}`,
    '',
    'Return one JSON object: pick, why, perOption[] (one row per option, same option strings),',
    'flipIf, unknowns[].',
  ].join('\n')

  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ]
}

/**
 * Grill — spec §4. Red-team the pick. This is the "yes? why no?" half of the user's question,
 * and it must not be allowed to rewrite the verdict: it produces a counter, never a new pick.
 */
export function buildGrill(project: Project, node: Decision, verdict: Verdict): ChatMessage[] {
  const path = pathTo(project.root, node.id)
    .slice(0, -1)
    .map((a) =>
      a.state === 'decided' && a.choice
        ? `- ${a.question} → decided: "${a.choice}"`
        : `- ${a.question} → undecided`,
    )

  const user = [
    `GOAL: ${project.goal}`,
    '',
    'CONTEXT:',
    ...(path.length > 0 ? path : ['(this is the first decision)']),
    '',
    `QUESTION: ${node.question}`,
    `OPTIONS: ${node.options.join(' | ')}`,
    '',
    `A previous answer picked "${verdict.pick}" because: ${verdict.why}`,
    '',
    'Argue the other side. What is the strongest case that this pick is wrong?',
    'Then name the single fact that would make it wrong.',
    'Return one JSON object: why, flipIf.',
  ].join('\n')

  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ]
}

/**
 * Expand — derivation, not brainstorming (spec §5.2). A child of a chosen option is a
 * *requirement* of that option, so the question is "what must be true for this to work", never
 * "what else is there to think about".
 */
export function buildExpand(project: Project, node: Decision): ChatMessage[] {
  const user = [
    `GOAL: ${project.goal}`,
    '',
    `DECIDED: ${node.question} → ${node.choice}`,
    '',
    'What must be true for that choice to work, and which decisions does it require?',
    'Return at most 3 questions. Questions only: no answers, no options, no recommendations.',
    'Return one JSON object: {"questions": string[]}',
  ].join('\n')

  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ]
}

/**
 * Premortem — Klein via decision-journal practice. Not "what could go wrong" in the abstract:
 * assume the choice already failed and name the likeliest reasons. Reuses the verdict's context so
 * the failure modes are about *this* option, not decisions in general.
 */
export function buildPremortem(project: Project, node: Decision): ChatMessage[] {
  const user = [
    `GOAL: ${project.goal}`,
    '',
    `DECIDED: ${node.question} → ${node.choice}`,
    node.rationale ? `REASONING: ${node.rationale}` : '',
    '',
    'It is twelve months from now and this choice has failed.',
    'Name the three most likely reasons it failed. Be specific to this option, not generic risk.',
    'For each, give a likelihood: low, medium or high. No mitigations, no reassurance.',
    'Return one JSON object: {"reasons":[{"why": string, "likelihood": "low|medium|high"}]}',
  ]
    .filter((line) => line !== '')
    .join('\n')

  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ]
}
