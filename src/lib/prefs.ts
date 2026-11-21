/**
 * Browser-local preferences. Not part of the project: which provider you are using is a property of
 * this browser, not of the decision log, so it never travels in an export or a share link.
 */

const ACTIVE = 'prudence.activeProvider'

export function getActiveProvider(): string | null {
  try {
    return localStorage.getItem(ACTIVE)
  } catch {
    return null
  }
}

export function setActiveProvider(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE, id)
    else localStorage.removeItem(ACTIVE)
  } catch {
    // private mode / storage disabled: the picker still works for this session
  }
}
