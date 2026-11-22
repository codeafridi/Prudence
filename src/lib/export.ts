import { calibration } from '../model/calibration.ts'
import { isFresh } from '../model/hash.ts'
import type { Decision, Project, Verdict } from '../model/types.ts'

/**
 * DECISIONS.md — spec §8. The artifact is the path you took plus what you rejected, not a picture.
 * Walk the decided chain depth-first; everything under an option you did not pick collapses into a
 * footnote, because the road not taken is evidence and deleting it is how the log starts lying.
 */
export function exportMarkdown(project: Project): string {
  const all = collect(project.root)
  const decided = all.filter((d) => d.state === 'decided')
  const closed = decided.filter((d) => d.children.length === 0).length
  const rate = decided.length === 0 ? 0 : Math.round((closed / decided.length) * 100)
  const rejected = all.reduce((n, node) => n + rejectedChildren(node).length, 0)
  const settled = all.reduce(
    (n, node) => n + node.children.filter((c) => c.via?.kind === 'assumption').length,
    0,
  )
  const cal = calibration(project.root)

  const out: string[] = [
    `# ${project.name} — decision log`,
    `Goal: ${project.goal}`,
    `${all.length} decisions · ${closed}/${decided.length} closed without children (${rate}%) · ` +
      `${rejected} rejected ${rejected === 1 ? 'branch' : 'branches'} · ${settled} assumption(s) settled`,
  ]

  if (cal.n > 0 && cal.brier !== null) {
    out.push(
      `Calibration: ${cal.n} ${cal.n === 1 ? 'call' : 'calls'} · said ${Math.round(cal.meanP * 100)}% · ` +
        `happened ${Math.round(cal.hitRate * 100)}% · Brier ${cal.brier.toFixed(2)}`,
    )
  }
  out.push('')

  writeNode(project, project.root, 1, out)
  return `${out.join('\n').trimEnd()}\n`
}

function writeNode(project: Project, node: Decision, depth: number, out: string[]): void {
  out.push(`${'#'.repeat(Math.min(depth + 1, 6))} ${node.question}`, '')

  if (node.state === 'decided' && node.choice) {
    out.push(`**Decided:** ${node.choice}${dateOf(node)}`, '')
    if (node.rationale) out.push(`> ${node.rationale}`, '')
    const ai = aiLine(project, node)
    if (ai) out.push(ai, '')

    if (node.premortem) {
      out.push('Premortem — if this failed, most likely because:', '')
      for (const reason of node.premortem.reasons) {
        out.push(`- ${reason.why} _(${reason.likelihood})_`)
      }
      out.push('')
    }

    if (node.review) {
      const said = node.review.p !== undefined ? ` · said ${node.review.p.toFixed(2)}` : ''
      out.push(`**Outcome:** ${node.review.verdict}${formatDate(node.review.at)}${said}`)
      if (node.review.note) out.push('', `> ${node.review.note}`)
      out.push('')
    } else if (node.reviewAt) {
      out.push(`_Review due ${new Date(node.reviewAt).toISOString().slice(0, 10)}._`, '')
    }
  } else {
    out.push(`**${node.state === 'parked' ? 'Parked' : 'Open'}** — not decided yet`, '')
  }

  for (const child of node.children) {
    if (node.state === 'decided' && node.choice && isRejected(node, child)) {
      writeRejected(child, out)
      continue
    }
    writeNode(project, child, depth + 1, out)
  }
}

function writeRejected(child: Decision, out: string[]): void {
  const via =
    child.via?.kind === 'option'
      ? child.via.option
      : child.via?.kind === 'risk'
        ? 'risk'
        : 'assumed'
  const summary = `rejected: ${via} — ${child.question}`
  out.push(`<details><summary>${summary}</summary>`, '')
  if (child.state === 'decided' && child.choice) {
    out.push(`Decided against it: chose **${child.choice}**${dateOf(child)}`)
    if (child.rationale) out.push('', `> ${child.rationale}`)
  } else {
    out.push('Not pursued.')
  }
  out.push('', '</details>', '')
}

function aiLine(project: Project, node: Decision): string | undefined {
  const verdict = node.verdicts[0]
  if (!verdict) return undefined

  const parts: string[] = [`AI: pick "${verdict.pick}"`]
  const aiP = perOptionP(verdict, node.choice)
  if (aiP !== undefined) {
    const human = node.pOverride
    parts.push(
      human === undefined ? `p ${aiP.toFixed(2)}` : `p ${aiP.toFixed(2)} → you ${human.toFixed(2)}`,
    )
  }
  if (verdict.unknowns.length > 0) parts.push(`assumed ${verdict.unknowns.join('; ')}`)
  if (!isFresh(project, node)) parts.push('(stale — the tree changed since this answer)')

  return parts.join(' · ')
}

function perOptionP(verdict: Verdict, option: string | undefined): number | undefined {
  if (!option) return undefined
  return verdict.perOption.find((c) => c.option === option)?.p
}

function isRejected(node: Decision, child: Decision): boolean {
  if (child.via?.kind === 'assumption') return false
  if (child.via?.kind !== 'option') return false
  return child.via.option !== node.choice
}

function rejectedChildren(node: Decision): Decision[] {
  if (node.state !== 'decided' || !node.choice) return []
  return node.children.filter((c) => isRejected(node, c))
}

function formatDate(timestamp: number): string {
  return ` — ${new Date(timestamp).toISOString().slice(0, 10)}`
}

function dateOf(node: Decision): string {
  return node.decidedAt ? formatDate(node.decidedAt) : ''
}

function collect(root: Decision): Decision[] {
  const out: Decision[] = []
  const walk = (node: Decision) => {
    out.push(node)
    node.children.forEach(walk)
  }
  walk(root)
  return out
}

const SECRET_KEYS = new Set(['key', 'apikey', 'api_key', 'authorization', 'token'])

/** JSON round-trip. Keys must never reach a file — spec §7.2. */
export function exportJson(project: Project): string {
  return `${JSON.stringify(strip(project), null, 2)}\n`
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.has(key.toLowerCase())) continue
      out[key] = strip(child)
    }
    return out
  }
  return value
}
