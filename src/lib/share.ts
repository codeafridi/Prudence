import type { Decision, Project } from '../model/types.ts'

/**
 * Share links without a server: the whole project goes in the URL hash.
 *
 * `#p=z<base64url>` is deflate-raw compressed, `#p=j<base64url>` is raw JSON for browsers without
 * CompressionStream. A hash never leaves the device (it is not sent in the request), so a shared
 * log is not uploaded anywhere — it is decoded locally. Keys were never in the project to begin
 * with (§7.2).
 */

const HASH_PREFIX = '#p='
const VERSION = 1

type Payload = { v: number; project: Project }

export function shareUrl(project: Project, location: { origin: string; pathname: string }): Promise<string> {
  return encodeProject(project).then((encoded) => `${location.origin}${location.pathname}${HASH_PREFIX}${encoded}`)
}

export async function encodeProject(project: Project): Promise<string> {
  const json = JSON.stringify({ v: VERSION, project } satisfies Payload)

  if (typeof CompressionStream === 'undefined') {
    return `j${base64UrlEncode(new TextEncoder().encode(json))}`
  }

  const compressed = new Blob([json as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  const bytes = new Uint8Array(await new Response(compressed).arrayBuffer())
  return `z${base64UrlEncode(bytes)}`
}

export async function decodeProject(encoded: string): Promise<Project | undefined> {
  try {
    const kind = encoded[0]
    const bytes = base64UrlDecode(encoded.slice(1))

    let json: string
    if (kind === 'z') {
      if (typeof DecompressionStream === 'undefined') return undefined
      const inflated = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
      json = await new Response(inflated).text()
    } else if (kind === 'j') {
      json = new TextDecoder().decode(bytes)
    } else {
      return undefined
    }

    const payload = JSON.parse(json) as Payload
    if (payload?.v !== VERSION || !isProject(payload.project)) return undefined
    return payload.project
  } catch {
    return undefined
  }
}

/** The hash we were opened with, if any. */
export function readShareHash(hash: string): string | undefined {
  if (!hash.startsWith(HASH_PREFIX)) return undefined
  const value = hash.slice(HASH_PREFIX.length)
  return value.length > 0 ? value : undefined
}

export function isProject(value: unknown): value is Project {
  if (!value || typeof value !== 'object') return false
  const project = value as Project
  if (typeof project.id !== 'string' || typeof project.goal !== 'string') return false
  if (!Array.isArray(project.providers)) return false
  return isDecision(project.root)
}

function isDecision(value: unknown): value is Decision {
  if (!value || typeof value !== 'object') return false
  const node = value as Decision
  if (typeof node.id !== 'string' || typeof node.question !== 'string') return false
  if (!Array.isArray(node.options) || node.options.length < 2) return false
  if (!Array.isArray(node.children) || !node.children.every(isDecision)) return false
  return true
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
