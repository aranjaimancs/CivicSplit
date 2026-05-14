/**
 * Daily OCR scan limit — tracked per group per device in localStorage.
 * Resets automatically each calendar day (key encodes the date).
 * This is a cost-control measure, not a security gate.
 */

export const DAILY_SCAN_LIMIT = 5

function storageKey(joinCode: string): string {
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  return `budgetsplit-scans-${joinCode}-${today}`
}

export function getScansUsed(joinCode: string): number {
  const val = localStorage.getItem(storageKey(joinCode))
  return val ? parseInt(val, 10) : 0
}

export function incrementScansUsed(joinCode: string): number {
  const next = getScansUsed(joinCode) + 1
  localStorage.setItem(storageKey(joinCode), String(next))
  return next
}

export function scansRemaining(joinCode: string): number {
  return Math.max(0, DAILY_SCAN_LIMIT - getScansUsed(joinCode))
}
