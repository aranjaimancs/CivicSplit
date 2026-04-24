/**
 * Settle Up Sunday utilities
 * The dismiss key includes today's date so the modal re-appears next Sunday automatically.
 */

export function isSunday(): boolean {
  return new Date().getDay() === 0
}

function dismissKey(joinCode: string): string {
  const today = new Date().toISOString().split('T')[0] // "2026-04-19"
  return `budgetsplit_sus_${joinCode}_${today}`
}

export function hasDismissedThisSunday(joinCode: string): boolean {
  return localStorage.getItem(dismissKey(joinCode)) === '1'
}

export function dismissThisSunday(joinCode: string): void {
  localStorage.setItem(dismissKey(joinCode), '1')
}
