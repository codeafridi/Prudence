import { useMemo } from 'react'
import { download, slugify } from '../lib/download'
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

  return (
    <div className="flex flex-1 flex-col overflow-hidden text-[12px]">
      <div className="flex-1 overflow-y-auto p-3">
        {findings.length === 0 ? (
          <p className="mt-8 text-center text-xs text-white/30">
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
                  className="w-full rounded border border-white/5 bg-white/[0.03] px-2 py-1 text-left hover:border-white/20"
                >
                  <span className="block text-[10px] uppercase tracking-wider text-amber-400/70">
                    {LABEL[finding.rule]}
                  </span>
                  <span className="block text-white/60">{finding.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1 border-t border-white/10 p-3">
        <span className="text-[10px] uppercase tracking-wider text-white/35">Export</span>
        <button
          onClick={() =>
            download(`${slugify(project.name)}-decisions.md`, exportMarkdown(project))
          }
          className="w-full rounded border border-white/15 px-2 py-1 text-[11px] text-white/80 hover:border-white/35 hover:text-white"
        >
          Decision log (.md)
        </button>
        <button
          onClick={() => {
            download(`${slugify(project.name)}.json`, exportJson(project), 'application/json')
          }}
          className="w-full rounded border border-white/10 px-2 py-1 text-[11px] text-white/50 hover:border-white/25 hover:text-white"
        >
          Project (.json)
        </button>
        <p className="pt-1 text-[10px] leading-snug text-white/20">
          Keys never leave this browser, so neither file can contain one.
        </p>
      </div>
    </div>
  )
}
