const key = (joinCode: string) => `budgetsplit-howto-${joinCode}`

export function hasSeenOnboarding(joinCode: string): boolean {
  return !!localStorage.getItem(key(joinCode))
}

export function markOnboardingSeen(joinCode: string): void {
  localStorage.setItem(key(joinCode), '1')
}
