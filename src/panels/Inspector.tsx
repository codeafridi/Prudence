import { useEffect, useState, type ReactNode } from 'react'
import { isFresh } from '../model/hash'
import { canRemoveOption, countNodes, findNode } from '../model/ops'
import type { Decision, Verdict } from '../model/types'
import { useStore } from '../state/store'

/**
 * The inspector is scanned, not read: quiet label, loud value, one hairline between sections.
 * Nothing here gets its own box — a field is a field because of its fill, not its border.
 */

const primary =
  'h-7 rounded-md bg-accent px-2.5 text-[11px] font-medium text-[#06231a] transition-colors hover:bg-accent/90 disabled:opacity-30'

const secondary =
  'h-7 rounded-md border border-line px-2 text-[11px] text-ink-2 transition-colors hover:border-line-hi hover:bg-white/5 hover:text-ink disabled:opacity-30'

const small = 'h-6 rounded px-1.5 text-[11px] text-ink-2 transition-colors hover:bg-white/5 hover:text-ink'

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="border-t border-line py-3 first:border-t-0 first:pt-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="label">{title}</span>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Inspector() {
  const root = useStore((s) => s.project.root)
  const selectedId = useStore((s) => s.selectedId)
  const node = selectedId ? findNode(root, selectedId) : undefined

  return (
    <div className="flex-1 overflow-y-auto px-3 pb-8 pt-3 text-[12px]">
      {!node ? (
        <div className="mt-16 px-4 text-center">
          <p className="text-[12px] text-ink-3">Select a node to edit it.</p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-3/70">
            Click an option's <span className="text-ink-2">+</span> to grow the tree.
          </p>
        </div>
      ) : (
        <div>
          <QuestionField key={node.id} node={node} />
          <VerdictSection node={node} />
          <DecisionSection key={`${node.id}-${node.state}`} node={node} />
          <PremortemSection node={node} />
          <OptionsSection node={node} />
          <ChildrenSection node={node} />
          {node.id !== root.id && <DeleteButton node={node} />}
          <p className="mt-3 border-t border-line pt-2 text-[10px] text-ink-3/70">
            {countNodes(node)} node{countNodes(node) === 1 ? '' : 's'} in subtree
          </p>
        </div>
      )}
    </div>
  )
}

function QuestionField({ node }: { node: Decision }) {
  const rename = useStore((s) => s.rename)
  const [value, setValue] = useState(node.question)

  useEffect(() => setValue(node.question), [node.question])

  const commitNow = () => {
    if (value.trim() && value.trim() !== node.question) rename(node.id, value)
  }

  return (
    <label className="block">
      <span className="label">Question</span>
      <textarea
        value={value}
        rows={2}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commitNow}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
        className="field mt-2 resize-none"
      />
    </label>
  )
}

function VerdictSection({ node }: { node: Decision }) {
  const project = useStore((s) => s.project)
  const ask = useStore((s) => s.ask)
  const asking = useStore((s) => s.askingId) === node.id
  // Only this node's failure: an error on another decision must not show up here.
  const askError = useStore((s) => (s.askError?.nodeId === node.id ? s.askError.message : null))
  const openSettings = useStore((s) => s.openSettings)
  const promoteUnknown = useStore((s) => s.promoteUnknown)
  const grill = useStore((s) => s.grill)
  const grilling = useStore((s) => s.grillingId) === node.id
  const hasProvider = project.providers.length > 0
  const latest = node.verdicts[0]

  return (
    <Section
      title="Ask"
      action={
        <button onClick={() => void ask(node.id)} disabled={asking} className={small}>
          {asking ? 'asking…' : latest ? 'ask again' : 'ask'}
        </button>
      }
    >
      {!hasProvider && (
        <button
          onClick={openSettings}
          className="w-full rounded-md border border-dashed border-white/20 px-2 py-1.5 text-[11px] text-ink-2 transition-colors hover:border-accent/50 hover:text-accent"
        >
          no model configured — add one
        </button>
      )}

      {askError && (
        <p className="rounded-md bg-red-500/10 px-2 py-1.5 text-[11px] leading-snug text-red-300/90">
          {askError}
        </p>
      )}

      {latest ? (
        <VerdictCard
          verdict={latest}
          stale={!isFresh(project, node)}
          grilling={grilling}
          onGrill={() => void grill(node.id)}
          onPromote={(text) => promoteUnknown(node.id, text)}
        />
      ) : (
        <p className="text-[11px] leading-relaxed text-ink-3">
          No answer yet. You can also decide without asking.
        </p>
      )}
    </Section>
  )
}

function VerdictCard({
  verdict,
  stale,
  grilling,
  onGrill,
  onPromote,
}: {
  verdict: Verdict
  stale: boolean
  grilling: boolean
  onGrill: () => void
  onPromote: (text: string) => void
}) {
  return (
    <div className="mt-2 rounded-md bg-white/[0.025] p-2">
      <p className="flex items-baseline gap-1.5 text-[12px] text-ink">
        <span className="label !text-[9px] text-accent">pick</span>
        <span className="min-w-0 flex-1 font-medium">{verdict.pick}</span>
        {stale && <span className="shrink-0 text-[10px] text-amber-400">stale</span>}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-2">{verdict.why}</p>

      <ul className="mt-2 space-y-px">
        {verdict.perOption.map((c) => (
          <li key={c.option} className="py-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-[11px] text-ink-2">{c.option}</span>
              <span className="shrink-0 tabular-nums text-[10px] text-ink-3">
                p {c.p.toFixed(2)} · {c.reversible ? 'reversible' : 'one-way'}
              </span>
            </div>
            <p className="text-[11px] text-ink-3">{c.outcome}</p>
          </li>
        ))}
      </ul>

      <p className="mt-1 border-t border-line pt-2 text-[11px] leading-relaxed text-ink-2">
        <span className="label !text-[9px] mr-1">flip if</span>
        {verdict.flipIf}
      </p>

      {verdict.counter ? (
        <div className="mt-2 rounded-md bg-red-500/[0.07] px-2 py-1.5">
          <span className="label !text-[9px] text-red-400/70">against</span>
          <p className="mt-0.5 text-[11px] leading-relaxed text-ink-2">{verdict.counter.why}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-3">
            <span className="label !text-[9px] mr-1">wrong if</span>
            {verdict.counter.flipIf}
          </p>
        </div>
      ) : (
        <button
          onClick={onGrill}
          disabled={grilling}
          className="mt-2 w-full rounded-md px-2 py-1 text-left text-[11px] text-ink-3 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
          title="Ask for the strongest case against this pick"
        >
          {grilling ? 'arguing…' : 'grill this pick'}
        </button>
      )}

      {verdict.unknowns.length > 0 && (
        <ul className="mt-2 space-y-0.5 border-t border-line pt-2">
          {verdict.unknowns.map((u) => (
            <li key={u} className="group flex items-start gap-1 text-[11px] text-sky-300/60">
              <span className="min-w-0 flex-1">assumed: {u}</span>
              <button
                onClick={() => onPromote(u)}
                title="Make this an explicit decision"
                className="shrink-0 px-0.5 text-ink-3 opacity-0 transition-opacity hover:text-sky-200 group-hover:opacity-100"
              >
                +
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-[10px] tabular-nums text-ink-3/60">
        {verdict.model} · {(verdict.tokens.in + verdict.tokens.out).toLocaleString()} tokens
      </p>
    </div>
  )
}

function DecisionSection({ node }: { node: Decision }) {
  const decide = useStore((s) => s.decide)
  const reopen = useStore((s) => s.reopen)
  const park = useStore((s) => s.park)
  const unpark = useStore((s) => s.unpark)
  const adjustP = useStore((s) => s.adjustP)
  const expand = useStore((s) => s.expand)
  const expanding = useStore((s) => s.expandingId) === node.id

  const [choice, setChoice] = useState(node.choice ?? '')
  const [rationale, setRationale] = useState(node.rationale ?? '')

  const decided = node.state === 'decided'
  const dirty = !decided || choice !== (node.choice ?? '') || rationale !== (node.rationale ?? '')
  const aiP = node.verdicts[0]?.perOption.find((c) => c.option === node.choice)?.p
  const p = node.pOverride ?? aiP ?? 0.5

  return (
    <Section title={decided ? 'Decision' : 'Decide'}>
      <ul className="space-y-0.5">
        {node.options.map((option) => (
          <li key={option}>
            <label
              className={[
                'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors',
                choice === option ? 'bg-white/[0.06] text-ink' : 'text-ink-2 hover:bg-white/[0.03]',
              ].join(' ')}
            >
              <input
                type="radio"
                name={`choice-${node.id}`}
                checked={choice === option}
                onChange={() => setChoice(option)}
                className="accent-emerald-400"
              />
              <span className="min-w-0 flex-1 truncate text-[12px]">{option}</span>
            </label>
          </li>
        ))}
      </ul>

      <textarea
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        rows={2}
        placeholder="Why — one line. Required."
        className="field mt-2 resize-none"
      />

      <div className="mt-2 flex items-center gap-1">
        <button
          onClick={() => decide(node.id, choice, rationale)}
          disabled={!choice || rationale.trim().length === 0 || !dirty}
          className={primary}
        >
          {decided ? 'Update decision' : 'Decide'}
        </button>

        {decided ? (
          <button
            onClick={() => reopen(node.id)}
            className={secondary}
            title="Archive this decision and think again"
          >
            Reopen
          </button>
        ) : node.state === 'parked' ? (
          <button onClick={() => unpark(node.id)} className={secondary}>
            Unpark
          </button>
        ) : (
          <button
            onClick={() => park(node.id)}
            className={secondary}
            title="Not now — keep it visible but out of the way"
          >
            Park
          </button>
        )}
      </div>

      {decided && (
        <button
          onClick={() => void expand(node.id)}
          disabled={expanding}
          className="mt-1 h-7 w-full rounded-md border border-line text-[11px] text-ink-2 transition-colors hover:border-line-hi hover:bg-white/5 hover:text-ink disabled:opacity-40"
          title="Show what this choice requires — questions only, no answers"
        >
          {expanding ? 'working out what it requires…' : 'what does this require?'}
        </button>
      )}

      {decided && (
        <div className="mt-2 rounded-md bg-white/[0.025] px-2 py-1.5">
          <div className="flex items-baseline justify-between text-[10px] text-ink-3">
            <span className="label !text-[9px]">your probability</span>
            <span className="flex items-baseline gap-1 tabular-nums text-ink-2">
              {p.toFixed(2)}
              {node.pOverride !== undefined && (
                <button
                  onClick={() => adjustP(node.id, undefined)}
                  className="text-[10px] text-ink-3 hover:text-ink"
                  title="Back to the model's estimate"
                >
                  reset
                </button>
              )}
            </span>
          </div>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={p}
            onChange={(e) => adjustP(node.id, Number(e.target.value))}
            className="mt-1 w-full accent-emerald-400"
          />
          <div className="flex justify-between text-[9px] text-ink-3/60">
            <span>unlikely</span>
            <span>{aiP === undefined ? 'no model estimate' : `model said ${aiP.toFixed(2)}`}</span>
            <span>likely</span>
          </div>
        </div>
      )}

      {decided && <ReviewControls node={node} />}

      {node.history.length > 0 && (
        <details className="mt-2 rounded-md bg-white/[0.02] px-2 py-1 text-[11px] text-ink-2">
          <summary className="cursor-pointer text-ink-3">
            {node.history.length} previous decision{node.history.length === 1 ? '' : 's'}
          </summary>
          <ul className="mt-1 space-y-1">
            {node.history.map((h, i) => (
              <li key={i}>
                <span className="text-ink-2">{h.choice}</span>
                <span className="text-ink-3/60"> — {new Date(h.at).toISOString().slice(0, 10)}</span>
                {h.rationale && <p className="text-ink-3">{h.rationale}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Section>
  )
}

function ReviewControls({ node }: { node: Decision }) {
  const setReviewAt = useStore((s) => s.setReviewAt)
  const recordReview = useStore((s) => s.recordReview)
  const [note, setNote] = useState('')

  const due = node.reviewAt !== undefined && node.reviewAt <= Date.now()

  return (
    <div className="mt-2 rounded-md bg-white/[0.025] px-2 py-1.5">
      <div className="flex items-center justify-between text-[10px] text-ink-3">
        <span className="label !text-[9px]">review</span>
        {node.review ? (
          <span className="text-ink-2">{node.review.verdict}</span>
        ) : node.reviewAt ? (
          <span className={due ? 'text-amber-400/80' : 'text-ink-3'}>
            {due ? 'due ' : 'on '}
            {new Date(node.reviewAt).toISOString().slice(0, 10)}
            <button
              onClick={() => setReviewAt(node.id, undefined)}
              className="ml-1 text-ink-3/60 hover:text-ink"
            >
              ×
            </button>
          </span>
        ) : (
          <span className="flex items-center rounded bg-white/[0.04] p-0.5">
            {[
              ['1m', 30],
              ['3m', 90],
              ['6m', 180],
            ].map(([label, days]) => (
              <button
                key={label}
                onClick={() => setReviewAt(node.id, days as number)}
                className="rounded px-1.5 py-0.5 text-[10px] text-ink-3 transition-colors hover:bg-white/5 hover:text-ink"
                title="Ask yourself later whether this was right"
              >
                {label}
              </button>
            ))}
          </span>
        )}
      </div>

      {node.review ? (
        <p className="mt-1 text-[11px] text-ink-3">
          checked {new Date(node.review.at).toISOString().slice(0, 10)}
          {node.review.note ? ` — ${node.review.note}` : ''}
        </p>
      ) : (
        <>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="what happened? (optional)"
            className="field mt-1.5"
          />
          <div className="mt-1.5 flex gap-0.5 rounded bg-white/[0.04] p-0.5">
            {(['worked', 'mixed', 'failed'] as const).map((verdict) => (
              <button
                key={verdict}
                onClick={() => recordReview(node.id, verdict, note)}
                className={[
                  'h-6 flex-1 rounded text-[10px] transition-colors hover:bg-white/5',
                  verdict === 'worked'
                    ? 'text-accent/80'
                    : verdict === 'failed'
                      ? 'text-red-400/70'
                      : 'text-ink-3',
                ].join(' ')}
              >
                {verdict}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function PremortemSection({ node }: { node: Decision }) {
  const premortem = useStore((s) => s.premortem)
  const busy = useStore((s) => s.premortemId) === node.id
  const promote = useStore((s) => s.promoteReason)

  if (node.state !== 'decided') return null

  return (
    <Section
      title="Premortem"
      action={
        <button
          onClick={() => void premortem(node.id)}
          disabled={busy}
          className={small}
          title="Assume this failed in a year — why?"
        >
          {busy ? 'thinking…' : node.premortem ? 'again' : 'run'}
        </button>
      }
    >
      {node.premortem ? (
        <ul className="space-y-0.5">
          {node.premortem.reasons.map((reason) => (
            <li
              key={reason.why}
              className="group flex items-start gap-2 rounded-md px-1 py-1 text-[11px] hover:bg-white/[0.03]"
            >
              <span className="min-w-0 flex-1 leading-relaxed text-ink-2">{reason.why}</span>
              <span
                className={[
                  'shrink-0 text-[9px] uppercase tracking-wider',
                  reason.likelihood === 'high'
                    ? 'text-red-400/70'
                    : reason.likelihood === 'medium'
                      ? 'text-amber-400/70'
                      : 'text-ink-3',
                ].join(' ')}
              >
                {reason.likelihood}
              </span>
              <button
                onClick={() => promote(node.id, reason.why)}
                title="Make this a decision to think about"
                className="shrink-0 text-ink-3 opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
              >
                +
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] leading-relaxed text-ink-3">
          Imagine it failed a year from now. Worth asking before you commit.
        </p>
      )}
    </Section>
  )
}

function OptionsSection({ node }: { node: Decision }) {
  const createChild = useStore((s) => s.createChild)
  const removeOption = useStore((s) => s.removeOption)
  const addOption = useStore((s) => s.addOption)
  const [draft, setDraft] = useState('')

  return (
    <Section title="Options">
      <ul className="space-y-0.5">
        {node.options.map((option) => (
          <li
            key={option}
            className="group flex items-center gap-2 rounded-md px-2 py-1 text-[12px] text-ink-2 hover:bg-white/[0.03]"
          >
            <span className="min-w-0 flex-1 truncate" title={option}>
              {option}
            </span>
            <button
              onClick={() => createChild(node.id, { kind: 'option', option })}
              title="Add a decision this option requires"
              className="text-ink-3 opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
            >
              +
            </button>
            <button
              onClick={() => removeOption(node.id, option)}
              disabled={!canRemoveOption(node, option)}
              title={
                canRemoveOption(node, option)
                  ? 'Remove option'
                  : 'In use, chosen, or would leave fewer than two options'
              }
              className="text-ink-3/60 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100 disabled:opacity-0"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <form
        className="mt-1"
        onSubmit={(e) => {
          e.preventDefault()
          addOption(node.id, draft)
          setDraft('')
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="add option…"
          className="field"
        />
      </form>

      <button
        onClick={() => createChild(node.id, { kind: 'assumption' })}
        title="A thing you had to assume — spec §4"
        className="mt-1 w-full rounded-md px-2 py-1 text-left text-[11px] text-ink-3 transition-colors hover:bg-sky-400/5 hover:text-sky-300"
      >
        + assumption
      </button>
    </Section>
  )
}

function ChildrenSection({ node }: { node: Decision }) {
  const select = useStore((s) => s.select)
  if (node.children.length === 0) return null

  return (
    <Section title={`Children (${node.children.length})`}>
      <ul className="space-y-0.5">
        {node.children.map((child) => (
          <li key={child.id}>
            <button
              onClick={() => select(child.id)}
              className="w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
            >
              <span className="block truncate text-[10px] text-ink-3">
                {child.via?.kind === 'option' ? child.via.option : 'assumed'}
              </span>
              <span className="block truncate text-[12px] text-ink-2">{child.question}</span>
            </button>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function DeleteButton({ node }: { node: Decision }) {
  const remove = useStore((s) => s.remove)
  const total = countNodes(node)

  return (
    <button
      onClick={() => {
        if (confirm(`Delete this node and its ${total - 1} descendant(s)?`)) remove(node.id)
      }}
      className="mt-3 w-full rounded-md px-2 py-1 text-left text-[11px] text-red-400/50 transition-colors hover:bg-red-500/10 hover:text-red-400"
    >
      Delete subtree ({total} node{total === 1 ? '' : 's'})
    </button>
  )
}
