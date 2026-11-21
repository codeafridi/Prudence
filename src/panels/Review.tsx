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

  return (
    <div className="flex flex-1 flex-col overflow-hidden text-[12px]">
      <div className="flex-1 overflow-y-auto p-3">
        {findings.length === 0 ? (
          <p className="mt-16 px-4 text-center text-[12px] leading-relaxed text-ink-3">
            Nothing to flag. The tree is consistent with itself.
          </p>
        ) : (
          <ul className="space-y-1">
            {findings.map((finding, i) => (
              <li key={`${finding.rule}-${finding.nodeId}-${i}`}>
                <button
                  onClick={() => {
                    select(finding.nodeId)
                    setPanel('node')
                  }}
                  className="w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <span className="label block !text-[9px] text-amber-400/80">
                    {LABEL[finding.rule]}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-2">
                    {finding.detail}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1 border-t border-line p-3">
        <span className="label">Export</span>
        <button
          onClick={() =>
            download(`${slugify(project.name)}-decisions.md`, exportMarkdown(project))
          }
          className="h-7 w-full rounded-md bg-accent px-2 text-[11px] font-medium text-[#06231a] transition-colors hover:bg-accent/90"
        >
          Decision log (.md)
        </button>
        <button
          onClick={() => {
            download(`${slugify(project.name)}.json`, exportJson(project), 'application/json')
          }}
          className="h-7 w-full rounded-md px-2 text-[11px] text-ink-2 transition-colors hover:bg-white/5 hover:text-ink"
        >
          Project (.json)
        </button>
        <button
          onClick={() => void copyShare()}
          className="h-7 w-full rounded-md px-2 text-[11px] text-ink-2 transition-colors hover:bg-white/5 hover:text-ink"
          title="A read-only copy of this tree, encoded in the URL — no server involved"
        >
          {share === 'copied'
            ? 'link copied'
            : share === 'error'
              ? 'clipboard blocked — use the file'
              : 'Copy share link'}
        </button>
        <p className="pt-1 text-[10px] leading-relaxed text-ink-3/70">
          Keys never leave this browser, so neither the file nor the link can contain one.
        </p>
      </div>
    </div>
  )
}
