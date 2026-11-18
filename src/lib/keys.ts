/**
 * API keys live in localStorage only — spec §7.2. Never in the project record, never in an export,
 * never in IndexedDB. The project can be shared; the key cannot.
 */

const PREFIX = 'prudence.key.'

export function getKey(providerId: string): string | null {
  try {
    return localStorage.getItem(PREFIX + providerId)
  } catch {
    return null
  }
}

export function setKey(providerId: string, key: string): void {
  try {
    if (key) localStorage.setItem(PREFIX + providerId, key)
    else localStorage.removeItem(PREFIX + providerId)
  } catch {
    // private mode / storage disabled: the app still works in zero-key mode
  }
}

export function hasKey(providerId: string): boolean {
  return (getKey(providerId)?.length ?? 0) > 0
}
