import { useEffect, useState } from 'react'
import { isFresh } from '../model/hash'
import { canRemoveOption, countNodes, findNode } from '../model/ops'
import type { Decision, Verdict } from '../model/types'
import { useStore } from '../state/store'

export function Inspector() {
  const root = useStore((s) => s.project.root)
  const selectedId = useStore((s) => s.selectedId)
  const node = selectedId ? findNode(root, selectedId) : undefined

  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-l border-white/10 bg-[#0e0e11] p-3 text-[13px]">
      {!node ? (
        <p className="mt-8 text-center text-xs text-white/30">
          Select a node to edit it.
          <br />
          Click an option's <span className="text-white/50">+</span> to grow the tree.
        </p>
      ) : (
        <div className="space-y-4">
          <QuestionField key={node.id} node={node} />
          <VerdictSection node={node} />
          <OptionsSection node={node} />
          <ChildrenSection node={node} />
          {node.id !== root.id && <DeleteButton node={node} />}
          <p className="border-t border-white/5 pt-2 text-[10px] text-white/25">
            {node.state} · {countNodes(node)} node{countNodes(node) === 1 ? '' : 's'} in subtree
          </p>
        </div>
      )}
    </aside>
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
      <span className="text-[10px] uppercase tracking-wider text-white/35">Question</span>
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
        className="mt-1 w-full resize-none rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[13px] leading-snug outline-none focus:border-white/30"
      />
    </label>
  )
}

function VerdictSection({ node }: { node: Decision }) {
  const project = useStore((s) => s.project)
  const ask = useStore((s) => s.ask)
  const asking = useStore((s) => s.askingId) === node.id
  const askError = useStore((s) => s.askError)
  const openSettings = useStore((s) => s.openSettings)
  const hasProvider = project.providers.length > 0
  const latest = node.verdicts[0]

  return (
    <section>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-white/35">Ask</span>
        <button
          onClick={() => void ask(node.id)}
          disabled={asking}
          className="rounded border border-white/15 px-2 py-0.5 text-[11px] text-white/80 hover:border-white/35 hover:text-white disabled:opacity-40"
        >
          {asking ? 'asking…' : latest ? 'ask again' : 'ask'}
        </button>
      </div>

      {!hasProvider && (
        <button
          onClick={openSettings}
          className="mt-1 w-full rounded border border-dashed border-white/15 px-2 py-1 text-[11px] text-white/40 hover:text-white"
        >
          no model configured — add one
        </button>
      )}

      {askError && <p className="mt-1 text-[11px] leading-snug text-red-400/80">{askError}</p>}

      {latest ? (
        <VerdictCard verdict={latest} stale={!isFresh(project, node)} />
      ) : (
        <p className="mt-1 text-[11px] text-white/25">
          No answer yet. You can also decide without asking.
        </p>
      )}
    </section>
  )
}

function VerdictCard({ verdict, stale }: { verdict: Verdict; stale: boolean }) {
  return (
    <div className="mt-2 space-y-2 rounded border border-white/10 bg-black/25 p-2">
      <p className="text-xs text-white/85">
        <span className="text-emerald-400">pick</span> {verdict.pick}
        {stale && <span className="ml-2 text-[10px] text-amber-400">stale</span>}
      </p>
      <p className="text-[11px] leading-snug text-white/55">{verdict.why}</p>

      <ul className="space-y-1">
        {verdict.perOption.map((c) => (
          <li key={c.option} className="rounded bg-white/[0.03] px-1.5 py-1 text-[11px]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-white/70">{c.option}</span>
              <span className="shrink-0 font-mono text-[10px] text-white/40">
                p {c.p.toFixed(2)} · {c.reversible ? 'reversible' : 'one-way'}
              </span>
            </div>
            <p className="text-white/40">{c.outcome}</p>
          </li>
        ))}
      </ul>

      <p className="text-[11px] leading-snug text-white/45">
        <span className="text-white/30">flip if </span>
        {verdict.flipIf}
      </p>

      {verdict.unknowns.length > 0 && (
        <ul className="space-y-0.5 border-t border-white/5 pt-1">
          {verdict.unknowns.map((u) => (
            <li key={u} className="text-[11px] text-sky-300/70">
              assumed: {u}
            </li>
          ))}
        </ul>
      )}

      <p className="text-[10px] text-white/20">
        {verdict.model} · {verdict.tokens.in + verdict.tokens.out} tokens
      </p>
    </div>
  )
}

function OptionsSection({ node }: { node: Decision }) {
  const createChild = useStore((s) => s.createChild)
  const removeOption = useStore((s) => s.removeOption)
  const addOption = useStore((s) => s.addOption)
  const [draft, setDraft] = useState('')

  return (
    <section>
      <span className="text-[10px] uppercase tracking-wider text-white/35">Options</span>
      <ul className="mt-1 space-y-1">
        {node.options.map((option) => (
          <li
            key={option}
            className="flex items-center gap-2 rounded border border-white/10 bg-black/20 px-2 py-1"
          >
            <span className="min-w-0 flex-1 truncate" title={option}>
              {option}
            </span>
            <button
              onClick={() => createChild(node.id, { kind: 'option', option })}
              title="Add a decision this option requires"
              className="text-white/40 hover:text-white"
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
              className="text-white/25 hover:text-red-400 disabled:opacity-20 disabled:hover:text-white/25"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <form
        className="mt-1 flex gap-1"
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
          className="min-w-0 flex-1 rounded border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none focus:border-white/30"
        />
      </form>

      <button
        onClick={() => createChild(node.id, { kind: 'assumption' })}
        title="A thing you had to assume — spec §4"
        className="mt-1 w-full rounded border border-sky-400/20 px-2 py-1 text-left text-[11px] text-sky-300/70 hover:border-sky-400/40 hover:text-sky-300"
      >
        + assumption
      </button>
    </section>
  )
}

function ChildrenSection({ node }: { node: Decision }) {
  const select = useStore((s) => s.select)
  if (node.children.length === 0) return null

  return (
    <section>
      <span className="text-[10px] uppercase tracking-wider text-white/35">
        Children ({node.children.length})
      </span>
      <ul className="mt-1 space-y-1">
        {node.children.map((child) => (
          <li key={child.id}>
            <button
              onClick={() => select(child.id)}
              className="w-full rounded border border-white/5 bg-white/[0.03] px-2 py-1 text-left hover:border-white/20"
            >
              <span className="block truncate text-[10px] text-white/35">
                {child.via?.kind === 'option' ? child.via.option : 'assumed'}
              </span>
              <span className="block truncate text-xs text-white/80">{child.question}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
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
      className="w-full rounded border border-red-500/20 px-2 py-1 text-[11px] text-red-400/70 hover:border-red-500/50 hover:text-red-400"
    >
      Delete subtree ({total} node{total === 1 ? '' : 's'})
    </button>
  )
}
