import { useEffect, useState, type ReactNode } from 'react'
import { isFresh } from '../model/hash'
import { canRemoveOption, countNodes, findNode } from '../model/ops'
import type { Decision, Verdict } from '../model/types'
import { useStore } from '../state/store'

/**
 * Marginalia: annotations in the record's margin, not a properties panel.
 * Quiet label, ruled value, hairline between sections, and actions written as commands —
 * deciding is amending the record, not pressing a button in a toolbar.
 */

const command =
  'font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-ink disabled:opacity-30 disabled:hover:text-ink-3'

const stampCommand =
  'border border-ink bg-ink px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-sheet transition-colors hover:bg-ink/90 disabled:opacity-30'

function Note({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="border-t border-rule-soft py-3.5 first:border-t-0">
      <div className="mb-2 flex items-baseline justify-between gap-2">
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
    <div className="flex-1 overflow-y-auto px-4 pb-10 pt-3 md:px-5">
      {!node ? (
        <div className="mt-20 px-2 text-center">
          <p className="font-serif text-[15px] italic text-ink-3">Nothing selected.</p>
          <p className="mt-2 font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-ink-3">
            Mark a clause to annotate it
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
          <p className="mt-3 border-t border-rule pt-2 font-mono text-[8px] uppercase tracking-[0.14em] text-ink-3">
            {countNodes(node)} clause{countNodes(node) === 1 ? '' : 's'} in this branch
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
      <span className="label">Clause</span>
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
        className="mt-1.5 w-full resize-none border-0 bg-transparent p-0 font-serif text-[17px] leading-[1.3] text-ink outline-none"
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
    <Note
      title="Second opinion"
      action={
        <button onClick={() => void ask(node.id)} disabled={asking} className={command}>
          {asking ? 'asking…' : latest ? 'ask again' : 'ask'}
        </button>
      }
    >
      {!hasProvider && (
        <button
          onClick={openSettings}
          className="w-full border border-dashed border-ink-3/60 px-2 py-1.5 text-left font-mono text-[9px] uppercase tracking-[0.12em] text-ink-3 transition-colors hover:border-stamp hover:text-stamp"
        >
          no model configured — add one
        </button>
      )}

      {askError && (
        <p className="border-l-2 border-stamp bg-[#9d36270a] py-1 pl-2 font-mono text-[9.5px] leading-relaxed text-stamp">
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
        <p className="font-serif text-[12.5px] leading-relaxed text-ink-3">
          No answer yet. You can also decide without asking.
        </p>
      )}
    </Note>
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
    <div className="border-l border-pencil/50 pl-3">
      <p className="flex items-baseline gap-2">
        <span className="label !text-stamp">pick</span>
        <span className="min-w-0 flex-1 font-serif text-[14px] leading-snug">{verdict.pick}</span>
        {stale && <span className="label !text-stamp">stale</span>}
      </p>
      <p className="mt-2 font-serif text-[12.5px] leading-[1.65] text-ink-2">{verdict.why}</p>

      <ul className="mt-3.5 space-y-2.5 border-t border-rule-soft pt-3">
        {verdict.perOption.map((c) => (
          <li key={c.option}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate font-mono text-[9.5px] text-ink-2">{c.option}</span>
              <span className="w-[92px] shrink-0 text-right font-mono text-[9px] tabular-nums text-ink-3">
                {c.p.toFixed(2)} · {c.reversible ? 'reversible' : 'one-way'}
              </span>
            </div>
            <p className="mt-0.5 font-serif text-[11.5px] leading-[1.45] text-ink-3">{c.outcome}</p>
          </li>
        ))}
      </ul>

      <p className="mt-3.5 border-t border-rule-soft pt-3 font-serif text-[12px] leading-[1.6] text-ink-2">
        <span className="label mr-2">flip if</span>
        {verdict.flipIf}
      </p>

      {verdict.counter ? (
        <div className="mt-3.5 border-t border-rule-soft pt-3">
          <span className="label !text-stamp">against</span>
          <p className="mt-1 font-serif text-[12px] leading-[1.6] text-ink-2">
            {verdict.counter.why}
          </p>
          <p className="mt-1 font-serif text-[11.5px] leading-snug text-ink-3">
            <span className="label mr-1">wrong if</span>
            {verdict.counter.flipIf}
          </p>
        </div>
      ) : (
        <button
          onClick={onGrill}
          disabled={grilling}
          className="mt-2 border-t border-rule-soft pt-2 text-left font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-stamp disabled:opacity-40"
          title="Ask for the strongest case against this pick"
        >
          {grilling ? 'arguing…' : 'grill this pick'}
        </button>
      )}

      {verdict.unknowns.length > 0 && (
        <ul className="mt-3.5 space-y-1.5 border-t border-rule-soft pt-3">
          {verdict.unknowns.map((u) => (
            <li key={u} className="group flex items-start gap-1">
              <span className="min-w-0 flex-1 font-serif text-[11.5px] leading-snug text-ink-2">
                <span className="label mr-1">assumed</span>
                {u}
              </span>
              <button
                onClick={() => onPromote(u)}
                title="Make this an explicit decision"
                className="shrink-0 font-mono text-[10px] text-ink-3 opacity-0 transition-opacity hover:text-stamp group-hover:opacity-100"
              >
                +
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3.5 border-t border-rule-soft pt-2 font-mono text-[8px] uppercase tracking-[0.14em] text-ink-3">
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
    <Note title={decided ? 'Filed decision' : 'Decide'}>
      <ul className="space-y-0.5">
        {node.options.map((option) => (
          <li key={option}>
            <label className="flex cursor-pointer items-baseline gap-2 py-1.5 font-mono text-[10.5px] text-ink-2">
              <input
                type="radio"
                name={`choice-${node.id}`}
                checked={choice === option}
                onChange={() => setChoice(option)}
                className="mt-0.5 accent-[#9d3627]"
              />
              <span className={choice === option ? 'min-w-0 flex-1 text-ink' : 'min-w-0 flex-1 truncate'}>
                {option}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <textarea
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        rows={2}
        placeholder="Why — one line. Required."
        className="rule-field mt-3.5 resize-none font-serif"
      />

      <div className="mt-3.5 flex items-center gap-3">
        {(!decided || dirty) && (
          <button
            onClick={() => decide(node.id, choice, rationale)}
            disabled={!choice || rationale.trim().length === 0}
            className={stampCommand}
          >
            {decided ? 'Update decision' : 'Decide'}
          </button>
        )}

        {decided ? (
          <button
            onClick={() => reopen(node.id)}
            className={command}
            title="Archive this decision and think again"
          >
            Reopen
          </button>
        ) : node.state === 'parked' ? (
          <button onClick={() => unpark(node.id)} className={command}>
            Unpark
          </button>
        ) : (
          <button
            onClick={() => park(node.id)}
            className={command}
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
          className="mt-2 w-full border-t border-rule-soft pt-2 text-left font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-ink disabled:opacity-40"
          title="Show what this choice requires — questions only, no answers"
        >
          {expanding ? 'working out what it requires…' : 'what does this require? →'}
        </button>
      )}

      {decided && (
        <div className="mt-2.5">
          <div className="flex items-baseline justify-between">
            <span className="label">Your probability</span>
            <span className="flex items-baseline gap-2 font-mono text-[11px] tabular-nums text-ink">
              {p.toFixed(2)}
              {node.pOverride !== undefined && (
                <button
                  onClick={() => adjustP(node.id, undefined)}
                  className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-3 hover:text-stamp"
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
            className="mt-1.5 w-full accent-[#9d3627]"
          />
          <div className="flex justify-between font-mono text-[8px] uppercase tracking-[0.1em] text-ink-3">
            <span>unlikely</span>
            <span>{aiP === undefined ? 'no model estimate' : `model said ${aiP.toFixed(2)}`}</span>
            <span>likely</span>
          </div>
        </div>
      )}

      {decided && <ReviewControls node={node} />}

      {node.history.length > 0 && (
        <details className="mt-2.5 border-t border-rule-soft pt-1.5">
          <summary className="cursor-pointer font-mono text-[8.5px] uppercase tracking-[0.12em] text-ink-3">
            {node.history.length} previous decision{node.history.length === 1 ? '' : 's'}
          </summary>
          <ul className="mt-1.5 space-y-1.5">
            {node.history.map((h, i) => (
              <li key={i} className="font-serif text-[11.5px] leading-snug">
                <span className="text-ink-2">{h.choice}</span>
                <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-ink-3">
                  {' '}
                  — {new Date(h.at).toISOString().slice(0, 10)}
                </span>
                {h.rationale && <p className="text-ink-3">{h.rationale}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Note>
  )
}

function ReviewControls({ node }: { node: Decision }) {
  const setReviewAt = useStore((s) => s.setReviewAt)
  const recordReview = useStore((s) => s.recordReview)
  const [note, setNote] = useState('')

  const due = node.reviewAt !== undefined && node.reviewAt <= Date.now()

  return (
    <div className="mt-2.5 border-t border-rule-soft pt-2">
      <div className="flex items-baseline justify-between">
        <span className="label">Review</span>
        {node.review ? (
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-2">
            {node.review.verdict}
          </span>
        ) : node.reviewAt ? (
          <span
            className={[
              'font-mono text-[9px] uppercase tracking-[0.12em]',
              due ? 'text-stamp' : 'text-ink-3',
            ].join(' ')}
          >
            {due ? 'due ' : 'on '}
            {new Date(node.reviewAt).toISOString().slice(0, 10)}
            <button
              onClick={() => setReviewAt(node.id, undefined)}
              className="ml-1.5 text-ink-3 hover:text-ink"
            >
              ×
            </button>
          </span>
        ) : (
          <span className="flex items-baseline gap-2">
            {[
              ['1m', 30],
              ['3m', 90],
              ['6m', 180],
            ].map(([label, days]) => (
              <button
                key={label}
                onClick={() => setReviewAt(node.id, days as number)}
                className={command}
                title="Ask yourself later whether this was right"
              >
                {label}
              </button>
            ))}
          </span>
        )}
      </div>

      {node.review ? (
        <p className="mt-1 font-serif text-[11.5px] leading-snug text-ink-3">
          checked {new Date(node.review.at).toISOString().slice(0, 10)}
          {node.review.p !== undefined ? ` · said ${node.review.p.toFixed(2)}` : ''}
          {node.review.note ? ` — ${node.review.note}` : ''}
        </p>
      ) : (
        <>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="what happened? (optional)"
            className="rule-field mt-1.5 font-serif !text-[11.5px]"
          />
          <div className="mt-2 flex items-baseline gap-4">
            {(['worked', 'mixed', 'failed'] as const).map((verdict) => (
              <button
                key={verdict}
                onClick={() => recordReview(node.id, verdict, note)}
                className={command}
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
    <Note
      title="Premortem"
      action={
        <button
          onClick={() => void premortem(node.id)}
          disabled={busy}
          className={command}
          title="Assume this failed in a year — why?"
        >
          {busy ? 'thinking…' : node.premortem ? 'again' : 'run'}
        </button>
      }
    >
      {node.premortem ? (
        <ul className="space-y-1.5">
          {node.premortem.reasons.map((reason) => (
            <li key={reason.why} className="group flex items-start gap-2">
              <span className="min-w-0 flex-1 font-serif text-[12px] leading-[1.45] text-ink-2">
                {reason.why}
              </span>
              <span
                className={[
                  'shrink-0 font-mono text-[8px] uppercase tracking-[0.12em]',
                  reason.likelihood === 'high'
                    ? 'text-stamp'
                    : reason.likelihood === 'medium'
                      ? 'text-ink-2'
                      : 'text-ink-3',
                ].join(' ')}
              >
                {reason.likelihood}
              </span>
              <button
                onClick={() => promote(node.id, reason.why)}
                title="Make this a decision to think about"
                className="shrink-0 font-mono text-[10px] text-ink-3 opacity-0 transition-opacity hover:text-stamp group-hover:opacity-100"
              >
                +
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-serif text-[12px] leading-[1.55] text-ink-3">
          Imagine it failed a year from now. Worth asking before you commit.
        </p>
      )}
    </Note>
  )
}

function OptionsSection({ node }: { node: Decision }) {
  const createChild = useStore((s) => s.createChild)
  const removeOption = useStore((s) => s.removeOption)
  const addOption = useStore((s) => s.addOption)
  const [draft, setDraft] = useState('')

  return (
    <Note title="Options">
      <ul className="space-y-px">
        {node.options.map((option) => (
          <li key={option} className="group flex items-baseline gap-2 py-1">
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-ink-2" title={option}>
              {option}
            </span>
            <button
              onClick={() => createChild(node.id, { kind: 'option', option })}
              title="Add a decision this option requires"
              className="font-mono text-[10px] text-ink-3 opacity-0 transition-opacity hover:text-stamp group-hover:opacity-100"
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
              className="font-mono text-[10px] text-ink-3 opacity-0 transition-opacity hover:text-stamp group-hover:opacity-100 disabled:opacity-0"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <form
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
          className="rule-field font-mono !text-[10px]"
        />
      </form>

      <button
        onClick={() => createChild(node.id, { kind: 'assumption' })}
        title="A thing you had to assume — spec §4"
        className="mt-1.5 w-full text-left font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-stamp"
      >
        + assumption
      </button>
    </Note>
  )
}

function ChildrenSection({ node }: { node: Decision }) {
  const select = useStore((s) => s.select)
  if (node.children.length === 0) return null

  return (
    <Note title={`Sub-clauses (${node.children.length})`}>
      <ul className="space-y-1">
        {node.children.map((child) => (
          <li key={child.id}>
            <button
              onClick={() => select(child.id)}
              className="w-full border-b border-rule-soft pb-1 text-left transition-colors last:border-0 hover:text-stamp"
            >
              <span className="block truncate font-mono text-[8px] uppercase tracking-[0.12em] text-ink-3">
                {child.via?.kind === 'option' ? child.via.option : 'assumed'}
              </span>
              <span className="mt-0.5 block truncate font-serif text-[12px] text-ink-2">
                {child.question}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Note>
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
      className="mt-3 w-full text-left font-mono text-[8.5px] uppercase tracking-[0.14em] text-stamp/60 transition-colors hover:text-stamp"
    >
      Strike out this branch ({total} clause{total === 1 ? '' : 's'})
    </button>
  )
}
