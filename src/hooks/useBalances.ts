import { useMemo } from 'react'
import { useGroupStore } from '../store'
import { computeBalances, simplifyDebts } from '../lib/calculations'
import type { MemberBalance, Transaction } from '../types'

export function useBalances(): {
  balances: MemberBalance[]
  transactions: Transaction[]
} {
  const { members, receipts } = useGroupStore()

  const balances = useMemo(
    () => computeBalances(members, receipts),
    [members, receipts]
  )

  const transactions = useMemo(
    () => simplifyDebts(balances),
    [balances]
  )

  return { balances, transactions }
}
