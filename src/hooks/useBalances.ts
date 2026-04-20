import { useMemo } from 'react'
import { useGroupStore } from '../store'
import { computeBalances, simplifyDebts, round2 } from '../lib/calculations'
import type { MemberBalance, Transaction } from '../types'

export function useBalances(): {
  balances: MemberBalance[]
  transactions: Transaction[]
} {
  const { members, receipts, settlements } = useGroupStore()

  const rawBalances = useMemo(
    () => computeBalances(members, receipts),
    [members, receipts]
  )

  // Apply settled payments on top of receipt-derived balances.
  // Each settlement { from_member → to_member, amount } is a cash transfer:
  // the payer's net improves (they paid out more), the receiver's net decreases.
  const balances = useMemo<MemberBalance[]>(() => {
    if (settlements.length === 0) return rawBalances

    const netMap = new Map(rawBalances.map((b) => [b.member.id, b.net]))

    for (const s of settlements) {
      const fromNet = netMap.get(s.from_member)
      const toNet = netMap.get(s.to_member)
      if (fromNet !== undefined) netMap.set(s.from_member, round2(fromNet + s.amount))
      if (toNet !== undefined) netMap.set(s.to_member, round2(toNet - s.amount))
    }

    return rawBalances.map((b) => ({ ...b, net: netMap.get(b.member.id) ?? b.net }))
  }, [rawBalances, settlements])

  const transactions = useMemo<Transaction[]>(
    () => simplifyDebts(balances),
    [balances]
  )

  return { balances, transactions }
}
