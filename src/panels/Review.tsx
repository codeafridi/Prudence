import { useMemo, useState } from 'react'
import { download, slugify } from '../lib/download'
import { shareUrl } from '../lib/share'
import { exportJson, exportMarkdown } from '../lib/export'
import { lint, type Finding } from '../model/lint'
import { useStore } from '../state/store'

const LABEL: Record<Finding['rule'], string> = {
  'unowned-assumption': 'unowned assumption',
  'irreversible-and-open': 'irreversible, undecided',
  'thin-rationale': 'thin rationale',
  premature: 'premature',
  'models-diverge': 'models disagree',
  'stale-on-path': 'stale on the path',
  'decided-in-dead-branch': 'decided in a dead branch',
  'at-risk': 'at risk',
  sprawl: 'sprawl',
  'duplicate-question': 'duplicate question',
  'review-due': 'review due',
}

export function Review() {
  const project = useStore((s) => s.project)
  const select = useStore((s) => s.select)
  const setPanel = useStore((s) => s.setPanel)
  const findings = useMemo(() => lint(project), [project])
  const [share, setShare] = useState<'idle' | 'copied' | 'error'>('idle')

  const copyShare = async () => {
    try {
      const url = await shareUrl(project, window.location)
      await navigator.clipboard.writeText(url)
      setShare('copied')
      setTimeout(() => setShare('idle'), 2000)
    } catch {
      setShare('error')
    }
  }

  const command =
    'w-full text-left font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-ink'

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-3 md:px-5">
        {findings.length === 0 ? (
          <p className="mt-20 px-2 text-center font-serif text-[14px] italic leading-relaxed text-ink-3">
            Nothing to flag. The record is consistent with itself.
          </p>
        ) : (
          <ul>
            {findings.map((finding, i) => (
              <li key={`${finding.rule}-${finding.nodeId}-${i}`}>
                <button
                  onClick={() => {
                    select(finding.nodeId)
                    setPanel('node')
                  }}
                  className="w-full border-b border-rule-soft py-2 text-left transition-colors last:border-0 hover:text-stamp"
                >
                  <span className="label block">{LABEL[finding.rule]}</span>
                  <span className="mt-1 block font-serif text-[12px] leading-[1.5] text-ink-2">
                    {finding.detail}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2 border-t border-ink px-4 py-3 md:px-5">
        <span className="label">Export</span>
        <button
          onClick={() =>
            download(`${slugify(project.name)}-decisions.md`, exportMarkdown(project))
          }
          className="w-full border border-ink bg-ink px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-sheet transition-colors hover:bg-ink/90"
        >
          Decision log (.md)
        </button>
        <button
          onClick={() => {
            download(`${slugify(project.name)}.json`, exportJson(project), 'application/json')
          }}
          className={command}
        >
          Project (.json)
        </button>
        <button
          onClick={() => void copyShare()}
          className={command}
          title="A read-only copy of this tree, encoded in the URL — no server involved"
        >
          {share === 'copied'
            ? 'link copied'
            : share === 'error'
              ? 'clipboard blocked — use the file'
              : 'Copy share link'}
        </button>
        <p className="pt-1 font-serif text-[10.5px] leading-[1.5] text-ink-3">
          Keys never leave this browser, so neither the file nor the link can contain one.
        </p>
      </div>
    </div>
  )
}
