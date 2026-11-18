import { effectiveP } from './ev.ts'
import { contextHash, isFresh } from './hash.ts'
import type { Decision, Project } from './types.ts'

/**
 * Deterministic findings — spec §6.5. No AI, no key, no tokens, no network.
 * Everything here is arithmetic over the tree, which is why it can run in zero-key mode.
 */

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
    | 'review-due'
  nodeId: string
  detail: string
}

const AT_RISK = 0.5
const SPRAWL_RATIO = 0.6
const SPRAWL_MIN_NODES = 5
const DUPLICATE = 0.7

const STOPWORDS = new Set([
  'a', 'an', 'the', 'do', 'we', 'i', 'is', 'are', 'to', 'of', 'for', 'and', 'or', 'it', 'this',
  'that', 'should', 'need', 'needs', 'be', 'with', 'on', 'in', 'at', 'if', 'can', 'will',
])

function words(text: string | undefined): number {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

function tokens(question: string): Set<string> {
  return new Set(
    question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0 && !STOPWORDS.has(t)),
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const token of a) if (b.has(token)) shared++
  return shared / (a.size + b.size - shared)
}

type Ctx = {
  parent?: Decision
  /** An ancestor chose a different option than the one this branch hangs off. */
  dead: boolean
  /** Every ancestor, and this node, sits on the decided chain from the root. */
  onSpine: boolean
}

export function lint(project: Project): Finding[] {
  const findings: Finding[] = []
  const all: Decision[] = []

  const visit = (node: Decision, ctx: Ctx) => {
    all.push(node)
    const latest = node.verdicts[0]
    const decided = node.state === 'decided'

    // 1. unowned assumption
    const assumptions = node.verdicts.reduce((n, v) => n + v.unknowns.length, 0)
    const promoted = node.children.some((c) => c.via?.kind === 'assumption')
    if (assumptions > 0 && !promoted) {
      findings.push({
        rule: 'unowned-assumption',
        nodeId: node.id,
        detail: `${assumptions} assumption(s) the model had to make are not nodes`,
      })
    }

    // 2. irreversible and still undecided
    if (!decided && latest && latest.perOption.length > 0) {
      if (latest.perOption.every((c) => !c.reversible)) {
        findings.push({
          rule: 'irreversible-and-open',
          nodeId: node.id,
          detail: 'every option is irreversible and this is still open',
        })
      }
    }

    // 3. thin rationale
    if (decided && words(node.rationale) < 4) {
      findings.push({
        rule: 'thin-rationale',
        nodeId: node.id,
        detail: `rationale is ${words(node.rationale)} word(s)`,
      })
    }

    // 4. premature
    if (ctx.parent && ctx.parent.state !== 'decided' && !ctx.dead) {
      findings.push({
        rule: 'premature',
        nodeId: node.id,
        detail: 'parent is not decided',
      })
    }

    // 5. models diverge
    const fresh = node.verdicts.filter((v) => v.contextHash === contextHash(project, node.id))
    if (fresh.length > 1) {
      const picks = new Set(fresh.map((v) => v.pick))
      if (picks.size > 1) {
        findings.push({
          rule: 'models-diverge',
          nodeId: node.id,
          detail: `models disagree: ${[...picks].join(' vs ')}`,
        })
      }
    }

    // 6. stale verdict on the decided path
    if (latest && !isFresh(project, node) && ctx.onSpine) {
      findings.push({
        rule: 'stale-on-path',
        nodeId: node.id,
        detail: 'answered against a tree that has since changed',
      })
    }

    // 7. decided inside an abandoned branch
    if (decided && ctx.dead) {
      findings.push({
        rule: 'decided-in-dead-branch',
        nodeId: node.id,
        detail: 'decided under an option you did not pick',
      })
    }

    // 8. at risk (backward induction)
    if (decided && effectiveP(node) < AT_RISK) {
      findings.push({
        rule: 'at-risk',
        nodeId: node.id,
        detail: `effectiveP ${effectiveP(node).toFixed(2)} < ${AT_RISK}`,
      })
    }

    // 9. the retrospective you scheduled and forgot
    if (decided && !node.review && node.reviewAt !== undefined && node.reviewAt <= Date.now()) {
      findings.push({
        rule: 'review-due',
        nodeId: node.id,
        detail: 'due for review — was this right?',
      })
    }

    for (const child of node.children) {
      const dead =
        ctx.dead ||
        (decided &&
          child.via?.kind === 'option' &&
          node.choice !== undefined &&
          child.via.option !== node.choice)
      const onSpine =
        ctx.onSpine &&
        decided &&
        child.via?.kind === 'option' &&
        node.choice === child.via.option
      visit(child, { parent: node, dead, onSpine })
    }
  }

  visit(project.root, { dead: false, onSpine: true })

  // 9. sprawl
  const withChildren = all.filter((n) => n.children.length > 0).length
  if (all.length >= SPRAWL_MIN_NODES && withChildren / all.length > SPRAWL_RATIO) {
    findings.push({
      rule: 'sprawl',
      nodeId: project.root.id,
      detail: `${withChildren}/${all.length} nodes have children — deciding is not expanding`,
    })
  }

  // 11. duplicate questions
  const tokenised = all.map((n) => ({ node: n, tokens: tokens(n.question) }))
  for (let i = 0; i < tokenised.length; i++) {
    for (let j = i + 1; j < tokenised.length; j++) {
      const score = jaccard(tokenised[i].tokens, tokenised[j].tokens)
      if (score >= DUPLICATE) {
        findings.push({
          rule: 'duplicate-question',
          nodeId: tokenised[i].node.id,
          detail: `same question as ${tokenised[j].node.id} (${score.toFixed(2)})`,
        })
      }
    }
  }

  return findings
}
