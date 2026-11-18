import { pOf } from '../model/ev.ts'
import { pathTo } from '../model/hash.ts'
import type { Decision, Project } from '../model/types.ts'
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

/** Derivation, not brainstorming — spec §5.2, milestone M4. */
export function buildExpand(_project: Project, _node: Decision): ChatMessage[] {
  throw new Error('buildExpand — spec §5.2, milestone M4')
}
