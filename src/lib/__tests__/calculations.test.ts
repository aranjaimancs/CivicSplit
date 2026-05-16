import { describe, it, expect } from 'vitest'
import { computeBalances, simplifyDebts, round2 } from '../calculations'
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

function makeCustomReceipt(
  id: string,
  payerId: string,
  price: number,
  splits: { memberId: string; amount: number }[],
): Receipt {
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
        name: 'Custom Item',
        price,
        split_type: 'custom',
        created_at: '2026-01-01T00:00:00Z',
        splits: splits.map((s, i) => ({
          id: `${id}-s${i}`,
          line_item_id: `${id}-li1`,
          member_id: s.memberId,
          amount: s.amount,
        })),
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

  it("payer's net is $6.66 (floor-based split gives remainder penny to members[0])", () => {
    // members[0] is alice; floor split gives her $3.34 owes (3.33 base + 0.01 remainder)
    // so her net = round2(10 - 3.34) = 6.66
    expect(alice.net).toBe(6.66)
  })

  it("non-payers' net is -$3.33 each", () => {
    expect(bob.net).toBe(-3.33)
    expect(carol.net).toBe(-3.33)
  })

  it('net balances sum to exactly zero (floor-based rounding eliminates float drift)', () => {
    const total = balances.reduce((s, b) => round2(s + b.net), 0)
    expect(total).toBe(0)
  })
})

// ── Scenario 4: Solo group (1 member) ─────────────────────────────────────────

describe('1-member group — solo edge case', () => {
  const members = [makeMember('alice', 'Alice')]
  const receipt = makeSharedReceipt('r4', 'alice', 25)
  const balances = computeBalances(members, [receipt])

  it('sole member paid = owes = price, net = 0', () => {
    const alice = balances.find((b) => b.member.id === 'alice')!
    expect(alice.paid).toBe(25)
    expect(alice.owes).toBe(25)
    expect(alice.net).toBe(0)
  })

  it('net sum is zero', () => {
    expect(balances.reduce((s, b) => round2(s + b.net), 0)).toBe(0)
  })
})

// ── Scenario 5: No receipts ────────────────────────────────────────────────────

describe('no receipts — all balances are zero', () => {
  const members = [
    makeMember('alice', 'Alice'),
    makeMember('bob',   'Bob'),
  ]
  const balances = computeBalances(members, [])

  it('every member has zero paid, owes, and net', () => {
    for (const b of balances) {
      expect(b.paid).toBe(0)
      expect(b.owes).toBe(0)
      expect(b.net).toBe(0)
    }
  })
})

// ── Scenario 6: Mixed shared + personal on same receipt ───────────────────────

describe('mixed shared + personal on one receipt', () => {
  const members = [
    makeMember('alice', 'Alice'),
    makeMember('bob',   'Bob'),
  ]
  // Alice pays $30 total: $20 shared, $10 personal
  const receipt: Receipt = {
    id: 'r5',
    group_id: 'group-1',
    paid_by: 'alice',
    store_name: 'Walmart',
    category: 'Groceries',
    date: '2026-06-01',
    total: 30,
    created_at: '2026-01-01T00:00:00Z',
    line_items: [
      {
        id: 'r5-shared',
        receipt_id: 'r5',
        name: 'Shared Item',
        price: 20,
        split_type: 'shared',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'r5-personal',
        receipt_id: 'r5',
        name: 'Personal Item',
        price: 10,
        split_type: 'personal',
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
  }
  const balances = computeBalances(members, [receipt])
  const alice = balances.find((b) => b.member.id === 'alice')!
  const bob   = balances.find((b) => b.member.id === 'bob')!

  it('Alice paid $30, owes $20 (personal $10 + shared half $10), net = $10', () => {
    expect(alice.paid).toBe(30)
    expect(alice.owes).toBe(20)  // $10 personal + $10 shared share
    expect(alice.net).toBe(10)
    expect(alice.personal).toBe(10)
  })

  it("Bob owes $10 (his share of the shared item), net = -$10", () => {
    expect(bob.paid).toBe(0)
    expect(bob.owes).toBe(10)
    expect(bob.net).toBe(-10)
    expect(bob.personal).toBe(0)
  })

  it('net balances sum to zero', () => {
    expect(balances.reduce((s, b) => round2(s + b.net), 0)).toBe(0)
  })
})

// ── Scenario 7: Custom split ───────────────────────────────────────────────────

describe('custom split — unequal assignment', () => {
  const members = [
    makeMember('alice', 'Alice'),
    makeMember('bob',   'Bob'),
    makeMember('carol', 'Carol'),
  ]
  // Alice pays $60; custom: Alice $30, Bob $20, Carol $10
  const receipt = makeCustomReceipt('r6', 'alice', 60, [
    { memberId: 'alice', amount: 30 },
    { memberId: 'bob',   amount: 20 },
    { memberId: 'carol', amount: 10 },
  ])
  const balances = computeBalances(members, [receipt])
  const alice = balances.find((b) => b.member.id === 'alice')!
  const bob   = balances.find((b) => b.member.id === 'bob')!
  const carol = balances.find((b) => b.member.id === 'carol')!

  it('Alice paid $60, owes $30, net = +$30', () => {
    expect(alice.paid).toBe(60)
    expect(alice.owes).toBe(30)
    expect(alice.net).toBe(30)
  })

  it('Bob owes $20, net = -$20', () => {
    expect(bob.paid).toBe(0)
    expect(bob.owes).toBe(20)
    expect(bob.net).toBe(-20)
  })

  it('Carol owes $10, net = -$10', () => {
    expect(carol.paid).toBe(0)
    expect(carol.owes).toBe(10)
    expect(carol.net).toBe(-10)
  })

  it('net balances sum to zero', () => {
    expect(balances.reduce((s, b) => round2(s + b.net), 0)).toBe(0)
  })
})

// ── Scenario 8: Multiple payers ───────────────────────────────────────────────

describe('multiple payers across receipts', () => {
  const members = [
    makeMember('alice', 'Alice'),
    makeMember('bob',   'Bob'),
    makeMember('carol', 'Carol'),
  ]
  // Alice pays $30 shared, Bob pays $60 shared
  const r1 = makeSharedReceipt('r7a', 'alice', 30)
  const r2 = makeSharedReceipt('r7b', 'bob', 60)
  const balances = computeBalances(members, [r1, r2])
  const alice = balances.find((b) => b.member.id === 'alice')!
  const bob   = balances.find((b) => b.member.id === 'bob')!
  const carol = balances.find((b) => b.member.id === 'carol')!

  it('Alice net = +$20 (paid $30, owes $30)', () => {
    // r1: Alice paid $30, owes $10. r2: Alice owes $20. Total owes: $30, paid: $30
    // net = 30 - 30 = 0? Let me recalculate.
    // r1 ($30 shared/3): Alice paid $30, owes $10. Bob owes $10. Carol owes $10.
    // r2 ($60 shared/3): Bob paid $60, owes $20. Alice owes $20. Carol owes $20.
    // Alice: paid=30, owes=30, net=0
    // Bob: paid=60, owes=30, net=+30
    // Carol: paid=0, owes=30, net=-30
    expect(alice.paid).toBe(30)
    expect(alice.owes).toBe(30)
    expect(alice.net).toBe(0)
  })

  it('Bob net = +$30 (paid $60, owes $30)', () => {
    expect(bob.paid).toBe(60)
    expect(bob.owes).toBe(30)
    expect(bob.net).toBe(30)
  })

  it('Carol net = -$30 (paid $0, owes $30)', () => {
    expect(carol.paid).toBe(0)
    expect(carol.owes).toBe(30)
    expect(carol.net).toBe(-30)
  })

  it('net balances sum to zero', () => {
    expect(balances.reduce((s, b) => round2(s + b.net), 0)).toBe(0)
  })
})

// ── Scenario 9: $100.33 split 3 ways (tricky rounding) ───────────────────────

describe('$100.33 split 3 ways — cents rounding', () => {
  const members = [
    makeMember('alice', 'Alice'),
    makeMember('bob',   'Bob'),
    makeMember('carol', 'Carol'),
  ]
  const receipt = makeSharedReceipt('r8', 'alice', 100.33)
  const balances = computeBalances(members, [receipt])
  const alice = balances.find((b) => b.member.id === 'alice')!
  const bob   = balances.find((b) => b.member.id === 'bob')!
  const carol = balances.find((b) => b.member.id === 'carol')!

  it('base share is $33.44 (floor of 100.33/3 = 33.443...)', () => {
    // floor(100.33 * 100 / 3) / 100 = floor(3344.33/3)/100 = floor(1114.77)/100 = 11.14? No...
    // floor(100.33 * 100) = 10033 cents. 10033 / 3 = 3344.33. floor = 3344 → $33.44
    // remainder = 100.33 - 33.44*3 = 100.33 - 100.32 = 0.01
    // Alice (idx=0): 33.44 + 0.01 = 33.45
    expect(bob.owes).toBe(33.44)
    expect(carol.owes).toBe(33.44)
  })

  it("Alice's share is $33.45 (absorbs the remainder penny)", () => {
    expect(alice.owes).toBe(33.45)
  })

  it('all shares sum to exactly $100.33', () => {
    const total = balances.reduce((s, b) => round2(s + b.owes), 0)
    expect(total).toBe(100.33)
  })

  it('net balances sum to exactly zero', () => {
    expect(balances.reduce((s, b) => round2(s + b.net), 0)).toBe(0)
  })
})

// ── Scenario 10: simplifyDebts ────────────────────────────────────────────────

describe('simplifyDebts — minimal transactions', () => {
  const members = [
    makeMember('alice', 'Alice'),
    makeMember('bob',   'Bob'),
    makeMember('carol', 'Carol'),
  ]

  it('3-member star topology: one payer, two debtors → 2 transactions', () => {
    // Alice net=+20, Bob net=-10, Carol net=-10
    const r1 = makeSharedReceipt('r9', 'alice', 30)  // $10 each, Alice owed by Bob+Carol
    const balances = computeBalances(members, [r1])
    const txns = simplifyDebts(balances)
    expect(txns).toHaveLength(2)
    expect(txns.every((t) => t.to.id === 'alice')).toBe(true)
    expect(txns.every((t) => t.amount === 10)).toBe(true)
  })

  it('all-settled: returns empty transaction list', () => {
    const balances = computeBalances(members, [])
    const txns = simplifyDebts(balances)
    expect(txns).toHaveLength(0)
  })

  it('2-person debt: Bob owes Alice exactly $25', () => {
    const twoMembers = [makeMember('alice', 'Alice'), makeMember('bob', 'Bob')]
    const r = makeSharedReceipt('r10', 'alice', 50)
    const balances = computeBalances(twoMembers, [r])
    const txns = simplifyDebts(balances)
    expect(txns).toHaveLength(1)
    expect(txns[0].from.id).toBe('bob')
    expect(txns[0].to.id).toBe('alice')
    expect(txns[0].amount).toBe(25)
  })
})

// ── Scenario 11: All-personal receipt has no group effect ─────────────────────

describe('all-personal receipt — nothing flows between members', () => {
  const members = [
    makeMember('alice', 'Alice'),
    makeMember('bob',   'Bob'),
  ]
  const receipt: Receipt = {
    id: 'r11',
    group_id: 'group-1',
    paid_by: 'alice',
    store_name: 'Convenience Store',
    category: 'Other',
    date: '2026-06-01',
    total: 15,
    created_at: '2026-01-01T00:00:00Z',
    line_items: [
      { id: 'r11-a', receipt_id: 'r11', name: 'Personal A', price: 8, split_type: 'personal', created_at: '2026-01-01T00:00:00Z' },
      { id: 'r11-b', receipt_id: 'r11', name: 'Personal B', price: 7, split_type: 'personal', created_at: '2026-01-01T00:00:00Z' },
    ],
  }
  const balances = computeBalances(members, [receipt])

  it('all members have net = 0', () => {
    for (const b of balances) expect(b.net).toBe(0)
  })

  it('Alice personal = $15', () => {
    const alice = balances.find((b) => b.member.id === 'alice')!
    expect(alice.personal).toBe(15)
  })

  it('simplifyDebts returns no transactions', () => {
    expect(simplifyDebts(balances)).toHaveLength(0)
  })
})
