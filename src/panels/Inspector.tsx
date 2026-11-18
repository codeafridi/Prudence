import { useEffect, useState } from 'react'
import { canRemoveOption, countNodes, findNode } from '../model/ops'
import type { Decision } from '../model/types'
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
