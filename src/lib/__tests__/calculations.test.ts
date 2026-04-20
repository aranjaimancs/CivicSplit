import { describe, it, expect } from 'vitest'
import { computeBalances, round2 } from '../calculations'
import type { Member, Receipt } from '../../types'

// ── Test helpers ───────────────────────────────────────────────────────────────

function makeMember(id: string, name: string): Member {
  return {
    id,
    group_id: 'group-1',
    user_id: `user-${id}`,
    display_name: name,
    avatar_color: '#4F46BB',
    created_at: '2026-01-01T00:00:00Z',
  }
}

function makeSharedReceipt(id: string, payerId: string, price: number): Receipt {
  return {
    id,
    group_id: 'group-1',
    paid_by: payerId,
    store_name: 'Test Store',
    category: 'Groceries',
    date: '2026-06-01',
    total: price,
    created_at: '2026-01-01T00:00:00Z',
    line_items: [
      {
        id: `${id}-li1`,
        receipt_id: id,
        name: 'Test Item',
        price,
        split_type: 'shared',
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
  }
}

function makePersonalReceipt(id: string, payerId: string, price: number): Receipt {
  return {
    id,
    group_id: 'group-1',
    paid_by: payerId,
    store_name: 'Test Store',
    category: 'Groceries',
    date: '2026-06-01',
    total: price,
    created_at: '2026-01-01T00:00:00Z',
    line_items: [
      {
        id: `${id}-li1`,
        receipt_id: id,
        name: 'Personal Item',
        price,
        split_type: 'personal',
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
  }
}

// ── Scenario 1: Standard 5-way equal split ─────────────────────────────────────

describe('5-way equal split', () => {
  const members = [
    makeMember('alice', 'Alice'),
    makeMember('bob',   'Bob'),
    makeMember('carol', 'Carol'),
    makeMember('dan',   'Dan'),
    makeMember('eve',   'Eve'),
  ]
  // Alice pays $50, split equally among all 5
  const receipt = makeSharedReceipt('r1', 'alice', 50)
  const balances = computeBalances(members, [receipt])

  it('payer (Alice) is owed $40', () => {
    const alice = balances.find((b) => b.member.id === 'alice')!
    expect(alice.paid).toBe(50)
    expect(alice.owes).toBe(10)   // her own share
    expect(alice.net).toBe(40)    // owed by the group
  })

  it('each non-payer owes $10', () => {
    for (const id of ['bob', 'carol', 'dan', 'eve']) {
      const b = balances.find((b) => b.member.id === id)!
      expect(b.paid).toBe(0)
      expect(b.owes).toBe(10)
      expect(b.net).toBe(-10)
    }
  })

  it('net balances sum to zero', () => {
    const total = balances.reduce((s, b) => round2(s + b.net), 0)
    expect(total).toBe(0)
  })
})

// ── Scenario 2: Personal item — payer claims 100% ─────────────────────────────

describe('personal item (one person claims 100%)', () => {
  const members = [
    makeMember('alice', 'Alice'),
    makeMember('bob',   'Bob'),
    makeMember('carol', 'Carol'),
  ]
  // Alice pays $30 for a personal item (only she owes it)
  const receipt = makePersonalReceipt('r2', 'alice', 30)
  const balances = computeBalances(members, [receipt])

  it('payer (Alice) nets to zero — personal items cancel out', () => {
    const alice = balances.find((b) => b.member.id === 'alice')!
    expect(alice.paid).toBe(30)
    expect(alice.owes).toBe(30)
    expect(alice.net).toBe(0)
  })

  it('other members are completely unaffected', () => {
    for (const id of ['bob', 'carol']) {
      const b = balances.find((b) => b.member.id === id)!
      expect(b.paid).toBe(0)
      expect(b.owes).toBe(0)
      expect(b.net).toBe(0)
    }
  })

  it('personal amount is tracked in the personal field', () => {
    const alice = balances.find((b) => b.member.id === 'alice')!
    expect(alice.personal).toBe(30)
  })

  it('net balances sum to zero', () => {
    const total = balances.reduce((s, b) => round2(s + b.net), 0)
    expect(total).toBe(0)
  })
})

// ── Scenario 3: $10 split 3 ways (rounding) ───────────────────────────────────

describe('$10 split 3 ways — rounding behaviour', () => {
  const members = [
    makeMember('alice', 'Alice'),
    makeMember('bob',   'Bob'),
    makeMember('carol', 'Carol'),
  ]
  // Alice pays $10 shared equally among 3 (each owes $3.333…)
  const receipt = makeSharedReceipt('r3', 'alice', 10)
  const balances = computeBalances(members, [receipt])

  const alice = balances.find((b) => b.member.id === 'alice')!
  const bob   = balances.find((b) => b.member.id === 'bob')!
  const carol = balances.find((b) => b.member.id === 'carol')!

  it('each non-payer owes $3.33 (rounded down)', () => {
    expect(bob.owes).toBe(3.33)
    expect(carol.owes).toBe(3.33)
  })

  it("payer's net is $6.67 (rounded from $6.666…)", () => {
    expect(alice.net).toBe(6.67)
  })

  it("non-payers' net is -$3.33 each", () => {
    expect(bob.net).toBe(-3.33)
    expect(carol.net).toBe(-3.33)
  })

  it('rounding discrepancy is at most $0.01', () => {
    const total = balances.reduce((s, b) => s + b.net, 0)
    // Due to rounding: 6.67 - 3.33 - 3.33 = 0.01 (one penny off)
    expect(Math.abs(total)).toBeLessThanOrEqual(0.01)
  })
})
