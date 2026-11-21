import serifUrl from '../assets/fonts/newsreader-normal-400_600-latin.woff2?url'
import serifItalicUrl from '../assets/fonts/newsreader-italic-400_500-latin.woff2?url'
import monoUrl from '../assets/fonts/ibm-plex-mono-normal-400-latin.woff2?url'
import monoMediumUrl from '../assets/fonts/ibm-plex-mono-normal-500-latin.woff2?url'
import type { Project } from '../model/types'
import { renderRecordHTML, type ExportFonts } from './html.ts'

/**
 * The export has to survive being opened on a machine that has never seen
 * Prudence, without a network. Fonts are therefore fetched once from the
 * same-origin build output and inlined as data URLs.
 */

async function toBase64(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url)
    if (!res.ok) return undefined
    const bytes = new Uint8Array(await res.arrayBuffer())
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    return btoa(binary)
  } catch {
    // A missing font is not fatal: css() falls back to Georgia.
    return undefined
  }
}

export async function loadFonts(): Promise<ExportFonts> {
  const [serif, serifItalic, mono, monoMedium] = await Promise.all([
    toBase64(serifUrl),
    toBase64(serifItalicUrl),
    toBase64(monoUrl),
    toBase64(monoMediumUrl),
  ])
  return { serif, serifItalic, mono, monoMedium }
}

export const slug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

/** Build the file and hand it to the browser's download machinery. */
export async function downloadRecord(project: Project): Promise<void> {
  const fonts = await loadFonts()
  const html = renderRecordHTML(project, { fonts })
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slug(project.name) || 'decision-record'}.html`
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
