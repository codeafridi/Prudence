import { clauseNumbers } from '../model/numbering.ts'
import type { Decision, Project } from '../model/types'

/**
 * A printed copy of the record: one self-contained HTML file, no network, no
 * scripts, no Prudence install required to read it. The design is the same
 * "Form 1" the app draws — paper, hairlines, clause numbers, a stamp for a
 * filed decision — because the point of the export is that the page still
 * looks like a record when it leaves the app.
 */

export type ExportFonts = {
  serif?: string
  serifItalic?: string
  mono?: string
  monoMedium?: string
}

export type ExportOptions = {
  fonts?: ExportFonts
  now?: Date
}

const esc = (s: string): string =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const date = (ts?: number): string =>
  ts ? new Date(ts).toISOString().slice(0, 10) : ''

const short = (p: number): string => p.toFixed(2).replace(/^0/, '')

type Counts = { entries: number; filed: number }

function count(root: Decision): Counts {
  const out = { entries: 0, filed: 0 }
  const walk = (d: Decision) => {
    out.entries += 1
    if (d.state === 'decided') out.filed += 1
    d.children.forEach(walk)
  }
  walk(root)
  return out
}

function pFor(d: Decision): number | undefined {
  if (d.pOverride !== undefined) return d.pOverride
  if (!d.choice) return undefined
  const latest = d.verdicts[0]
  const c = latest?.perOption.find((o) => o.option === d.choice)
  return c?.p
}

function stamp(d: Decision): string {
  if (d.state === 'decided') {
    const when = date(d.decidedAt)
    return `<span class="stamp filed">Filed${when ? ` · ${when}` : ''}</span>`
  }
  if (d.state === 'parked') return '<span class="stamp parked">Parked</span>'
  if (d.state === "asked") return '<span class="stamp open">Asked</span>'
  return '<span class="stamp open">Open</span>'
}

function via(d: Decision): string {
  if (!d.via) return ''
  if (d.via.kind === 'option') return `Under “${esc(d.via.option)}”`
  if (d.via.kind === 'risk') return 'From a premortem risk'
  return 'Assumed rather than decided'
}

function options(d: Decision): string {
  const p = pFor(d)
  return d.options
    .map((o) => {
      const chosen = d.state === 'decided' && d.choice === o
      const mark = chosen ? '●' : '○'
      const prob = chosen && p !== undefined ? `<span class="p">p ${short(p)}</span>` : ''
      return `<li class="${chosen ? 'chosen' : ''}"><span class="mark">${mark}</span><span class="opt">${esc(o)}</span>${prob}</li>`
    })
    .join('')
}

function block(label: string, text?: string): string {
  if (!text) return ''
  return `<div class="note"><span class="label">${label}</span><p>${esc(text)}</p></div>`
}

function premortem(d: Decision): string {
  const reasons = d.premortem?.reasons ?? []
  if (reasons.length === 0) return ''
  const items = reasons
    .map((r) => `<li>${esc(r.why)} <span class="likelihood">${esc(r.likelihood)}</span></li>`)
    .join('')
  return `<div class="note"><span class="label">Premortem</span><ul class="plain">${items}</ul></div>`
}

function review(d: Decision): string {
  if (!d.review) return ''
  const note = d.review.note ? ` — ${esc(d.review.note)}` : ''
  return `<div class="note"><span class="label">Outcome · ${date(d.review.at)}</span><p class="review-${esc(d.review.verdict)}">${esc(d.review.verdict)}${note}</p></div>`
}

function entry(d: Decision, clause: string, abandoned = false): string {
  const latest = d.verdicts[0]
  const unknowns =
    latest && latest.unknowns.length > 0
      ? `<div class="note"><span class="label">Assumed</span><ul class="plain">${latest.unknowns
          .map((u) => `<li>${esc(u)}</li>`)
          .join('')}</ul></div>`
      : ''

  const viaLine = [via(d), abandoned ? 'Branch not taken' : ''].filter(Boolean).join(' · ')

  return `<li class="entry${abandoned ? ' abandoned' : ''}">
  <div class="head">
    <span class="clause">${esc(clause)}</span>
    <h2 class="question">${esc(d.question)}</h2>
    ${stamp(d)}
  </div>
  <div class="body">
    ${viaLine ? `<div class="via">${viaLine}</div>` : ''}
    <ul class="options">${options(d)}</ul>
    ${block('Rationale', d.rationale)}
    ${block('Why', latest?.why)}
    ${block('Flip if', latest?.flipIf)}
    ${unknowns}
    ${premortem(d)}
    ${review(d)}
  </div>
</li>`
}

function fontFace(family: string, data: string | undefined, weight: string, style = 'normal'): string {
  if (!data) return ''
  return `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${data}) format("woff2")}`
}

function css(fonts: ExportFonts): string {
  return `${fontFace('Newsreader', fonts.serif, '400 600')}
${fontFace('Newsreader', fonts.serifItalic, '400 500', 'italic')}
${fontFace('IBM Plex Mono', fonts.mono, '400')}
${fontFace('IBM Plex Mono', fonts.monoMedium, '500')}
:root{
  --paper:#f2eee3;--sheet:#fbf9f2;--ink:#1b1a17;--ink-2:#413d35;--ink-3:#575246;
  --rule:#cfc7b4;--hair:#e0d8c6;--stamp:#a2432c;
  --serif:"Newsreader",Georgia,"Times New Roman",serif;
  --mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
}
*{box-sizing:border-box}
html{background:var(--paper)}
body{margin:0;color:var(--ink);font-family:var(--serif);font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.desk{max-width:860px;margin:0 auto;padding:26px 24px 64px}
.toolbar{display:flex;align-items:center;justify-content:flex-end;max-width:780px;margin:0 auto 10px}
.print{padding:2px 0;border:0;border-bottom:1px solid #b3ab99;background:transparent;color:var(--ink-3);font-family:var(--mono);font-size:8px;letter-spacing:.16em;text-transform:uppercase;cursor:pointer}
.print:hover{color:var(--ink);border-color:var(--ink)}
.page{max-width:780px;margin:0 auto;padding:54px 48px 56px;background:var(--sheet);box-shadow:0 1px 2px #1b1a170f,0 16px 44px #1b1a1712}
.masthead{display:flex;align-items:baseline;justify-content:space-between;gap:16px;border-bottom:1.5px solid var(--ink);padding-bottom:10px}
.wordmark{font-family:var(--mono);font-size:13px;font-weight:600;letter-spacing:.3em;text-transform:uppercase}
.form{font-family:var(--mono);font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-3)}
.subject{margin:26px 0 0}
.label{display:block;margin-bottom:3px;font-family:var(--mono);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#4e4a3f}
h1{font-size:29px;line-height:1.2;font-weight:500;margin:2px 0 0;letter-spacing:-.01em}
.goal{margin:8px 0 0;color:var(--ink-2);font-size:14.5px;max-width:62ch}
.meta{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 10px;margin:20px 0 0;font-family:var(--mono);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3)}
.meta .sep{color:#c9c2b2}
.entries{list-style:none;margin:24px 0 0;padding:0}
.entry{display:block;padding:24px 0 22px;border-top:1px solid var(--hair);break-inside:avoid}
.entry:first-child{border-top:1.5px solid var(--ink)}
.entry.abandoned{opacity:.62}
.head{display:flex;align-items:baseline;gap:12px}
.clause{flex:none;width:28px;font-family:var(--mono);font-size:11px;color:var(--ink-3)}
.question{flex:1;font-size:19px;line-height:1.35;font-weight:500;margin:0 0 8px;letter-spacing:-.005em}
.stamp{flex:none;align-self:flex-start;transform:translateY(1px) rotate(-2deg);padding:3px 7px 2px;border:1px solid currentColor;font-family:var(--mono);font-size:8px;font-weight:500;letter-spacing:.18em;text-transform:uppercase}
.body{margin-left:40px}
.stamp.filed{color:var(--stamp)}
.stamp.open,.stamp.parked{color:#4e4a3f}
.via{margin:-3px 0 10px;font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3)}
.options{list-style:none;margin:0 0 12px;padding:0}
.options li{display:grid;grid-template-columns:16px 1fr auto;align-items:baseline;gap:8px;padding:2px 0;color:var(--ink-3)}
.options li.chosen{color:var(--ink)}
.mark{font-family:var(--mono);font-size:11px;line-height:1}
.opt{font-size:15px}
.p{font-family:var(--mono);font-size:9px;letter-spacing:.08em;color:var(--ink-3)}
.note{margin:11px 0 0}
.note p{margin:0;font-size:14px;color:var(--ink-2);max-width:66ch}
.note ul{margin:0;padding:0;list-style:none;font-size:13.5px;color:var(--ink-2);max-width:66ch}
.note li{padding:1px 0}
.likelihood{font-family:var(--mono);font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)}
.review-worked{color:var(--ink)!important}
.review-failed{color:var(--stamp)!important}
.key{margin:16px 0 0;font-family:var(--mono);font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3)}
footer{margin-top:32px;padding-top:11px;border-top:1.5px solid var(--ink);display:flex;justify-content:space-between;gap:16px;font-family:var(--mono);font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)}
@page{size:A4;margin:18mm 16mm}
@media print{
  html,body{background:#fff}
  .desk{max-width:none;padding:0}
  .toolbar{display:none}
  .page{max-width:none;padding:0;background:#fff;box-shadow:none}
  a{color:inherit;text-decoration:none}
  .entry{break-inside:avoid}
}
@media (max-width:600px){
  .desk{padding:16px 12px 40px}
  .page{padding:28px 20px 36px}
  .head{flex-wrap:wrap;gap:8px}
  .clause{width:24px}
  .stamp{margin-left:auto}
  .body{margin-left:32px}
  h1{font-size:23px}
}`
}

export function renderRecordHTML(project: Project, opts: ExportOptions = {}): string {
  const now = opts.now ?? new Date()
  const clauses = clauseNumbers(project.root)
  const counts = count(project.root)

  const entries: string[] = []
  const walk = (d: Decision, abandoned = false) => {
    entries.push(entry(d, clauses.get(d.id) ?? '1', abandoned))
    for (const child of d.children) {
      const childAbandoned =
        abandoned ||
        (d.state === 'decided' &&
          child.via?.kind === 'option' &&
          child.via.option !== d.choice)
      walk(child, childAbandoned)
    }
  }
  walk(project.root)

  const meta = [
    project.createdAt ? `Opened ${date(project.createdAt)}` : 'Undated draft',
    `Entries ${counts.entries}`,
    `Filed ${counts.filed}`,
    `Printed ${date(now.getTime())}`,
  ]
    .map((m) => `<span>${m}</span>`)
    .join('<span class="sep">·</span>')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(project.name)} — decision record</title>
<style>${css(opts.fonts ?? {})}</style>
</head>
<body>
<div class="desk">
  <div class="toolbar">
    <button class="print" onclick="window.print()">Print / save as PDF</button>
  </div>
  <main class="page">
    <div class="masthead">
      <div class="wordmark">Prudence</div>
      <div class="form">Decision record · form 1</div>
    </div>

    <div class="subject">
      <span class="label">Subject of record</span>
      <h1>${esc(project.name)}</h1>
      ${project.goal ? `<p class="goal">${esc(project.goal)}</p>` : ''}
      <div class="meta">${meta}</div>
    </div>

    <ol class="entries">${entries.join('\n')}</ol>

    <p class="key">● chosen &nbsp;·&nbsp; ○ not chosen</p>

    <footer>
      <span>Prudence · printed copy</span>
      <span>${esc(project.name)} · ${date(now.getTime())}</span>
    </footer>
  </main>
</div>
</body>
</html>
`
}
