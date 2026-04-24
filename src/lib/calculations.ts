import type { Member, Receipt, LineItem, LineItemSplit, MemberBalance, Transaction } from '../types'

// ============================================================
// Balance calculation
// ============================================================

/**
 * Compute the net balance for every member in the group.
 *
 * "personal" item edge case (confirmed behavior):
 *   - A personal item nets to ZERO in group balances: the payer paid
 *     it and owes it only to themselves, so it cancels out.
 *   - It IS tracked separately in `personal` for the weekly/stipend view.
 *   - Other members owe nothing for it.
 */
export function computeBalances(
  members: Member[],
  receipts: Receipt[],
): MemberBalance[] {
  // paid[memberId] = total amount paid out of pocket
  const paid: Record<string, number> = {}
  // owes[memberId] = total this person owes the group
  const owes: Record<string, number> = {}
  // personal[memberId] = personal items total (stipend tracking only)
  const personal: Record<string, number> = {}

  for (const m of members) {
    paid[m.id] = 0
    owes[m.id] = 0
    personal[m.id] = 0
  }

  for (const receipt of receipts) {
    const payer = receipt.paid_by
    const items: LineItem[] = receipt.line_items ?? []

    for (const item of items) {
      const price = Number(item.price)

      if (item.split_type === 'shared') {
        // Split equally among all members
        const share = price / members.length
        paid[payer] = (paid[payer] ?? 0) + price
        for (const m of members) {
          owes[m.id] = (owes[m.id] ?? 0) + share
        }
      } else if (item.split_type === 'personal') {
        // Payer paid AND owes — nets to zero in group balances
        paid[payer] = (paid[payer] ?? 0) + price
        owes[payer] = (owes[payer] ?? 0) + price
        personal[payer] = (personal[payer] ?? 0) + price
      } else if (item.split_type === 'custom') {
        const splits: LineItemSplit[] = item.splits ?? []
        const totalSplit = splits.reduce((sum, s) => sum + Number(s.amount), 0)
        paid[payer] = (paid[payer] ?? 0) + totalSplit
        for (const split of splits) {
          owes[split.member_id] = (owes[split.member_id] ?? 0) + Number(split.amount)
        }
      }
    }
  }

  return members.map((m) => ({
    member: m,
    paid: round2(paid[m.id] ?? 0),
    owes: round2(owes[m.id] ?? 0),
    net: round2((paid[m.id] ?? 0) - (owes[m.id] ?? 0)),
    personal: round2(personal[m.id] ?? 0),
  }))
}

// ============================================================
// Debt simplification (greedy algorithm)
// ============================================================

/**
 * Given a list of member balances, produce the minimal set of
 * transactions needed to settle all debts.
 *
 * Uses the standard greedy approach:
 *   1. Separate members into creditors (net > 0) and debtors (net < 0)
 *   2. Repeatedly match the largest creditor with the largest debtor
 */
export function simplifyDebts(balances: MemberBalance[]): Transaction[] {
  const transactions: Transaction[] = []

  // Work with mutable copies of net balances
  const credits = balances
    .filter((b) => b.net > 0.005)
    .map((b) => ({ member: b.member, amount: b.net }))
    .sort((a, b) => b.amount - a.amount)

  const debts = balances
    .filter((b) => b.net < -0.005)
    .map((b) => ({ member: b.member, amount: -b.net })) // positive
    .sort((a, b) => b.amount - a.amount)

  let ci = 0
  let di = 0

  while (ci < credits.length && di < debts.length) {
    const credit = credits[ci]
    const debt = debts[di]
    const amount = Math.min(credit.amount, debt.amount)

    if (amount > 0.005) {
      transactions.push({
        from: debt.member,
        to: credit.member,
        amount: round2(amount),
      })
    }

    credit.amount = round2(credit.amount - amount)
    debt.amount = round2(debt.amount - amount)

    if (credit.amount < 0.005) ci++
    if (debt.amount < 0.005) di++
  }

  return transactions
}

// ============================================================
// Helpers
// ============================================================

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Generate a Venmo deep link */
export function venmoLink(handle: string, amount: number, note = 'BudgetSplit'): string {
  const params = new URLSearchParams({
    txn: 'pay',
    recipients: handle,
    amount: amount.toFixed(2),
    note,
  })
  return `venmo://paycharge?${params.toString()}`
}

/** Format currency */
export function fmt(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}
