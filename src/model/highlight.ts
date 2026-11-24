export interface HighlightSegment {
  text: string
  match: boolean
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Split text into plain and matching segments for the finder. Tokens are matched
 * case-insensitively; the longest token wins when two overlap.
 */
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  const tokens = Array.from(new Set(query.trim().toLowerCase().split(/\s+/).filter(Boolean))).sort(
    (a, b) => b.length - a.length,
  )

  if (!tokens.length || !text) {
    return text ? [{ text, match: false }] : []
  }

  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'gi')
  return text
    .split(pattern)
    .filter((part) => part !== '')
    .map((part) => ({ text: part, match: tokens.includes(part.toLowerCase()) }))
}
