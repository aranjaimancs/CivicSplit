import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Group, Member, Receipt, Settlement } from '../types'

// ============================================================
// Session store — persisted to localStorage
// ============================================================

interface SessionState {
  /** Anonymous user ID (stable per browser, replaced by auth UID when signed in) */
  userId: string
  /** Map from join_code → member_id for groups we've joined */
  memberships: Record<string, string>

  setMembership: (joinCode: string, memberId: string) => void
  getMemberId: (joinCode: string) => string | undefined
  clearMembership: (joinCode: string) => void
  /** Bulk-set memberships from DB (called after auth sign-in) */
  hydrateMemberships: (map: Record<string, string>) => void
}

function generateUserId(): string {
  return crypto.randomUUID()
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      userId: generateUserId(),
      memberships: {},

      setMembership: (joinCode, memberId) =>
        set((s) => ({ memberships: { ...s.memberships, [joinCode]: memberId } })),

      getMemberId: (joinCode) => get().memberships[joinCode],

      clearMembership: (joinCode) =>
        set((s) => {
          const next = { ...s.memberships }
          delete next[joinCode]
          return { memberships: next }
        }),

      hydrateMemberships: (map) => set({ memberships: map }),
    }),
    { name: 'budgetsplit-session' }
  )
)

// ============================================================
// Group store — in-memory, populated from Supabase
// ============================================================

interface GroupState {
  group: Group | null
  members: Member[]
  receipts: Receipt[]
  settlements: Settlement[]
  loading: boolean
  error: string | null

  setGroup: (group: Group) => void
  setMembers: (members: Member[]) => void
  setReceipts: (receipts: Receipt[]) => void
  setSettlements: (settlements: Settlement[]) => void
  addSettlement: (settlement: Settlement) => void
  addReceipt: (receipt: Receipt) => void
  updateReceipt: (receipt: Receipt) => void
  removeReceipt: (id: string) => void
  updateMember: (id: string, patch: Partial<Member>) => void
  setLoading: (v: boolean) => void
  setError: (e: string | null) => void
  reset: () => void
}

const defaultGroupState = {
  group: null,
  members: [],
  receipts: [],
  settlements: [],
  loading: false,
  error: null,
}

export const useGroupStore = create<GroupState>()((set) => ({
  ...defaultGroupState,

  setGroup: (group) => set({ group }),
  setMembers: (members) => set({ members }),
  setReceipts: (receipts) => set({ receipts }),
  setSettlements: (settlements) => set({ settlements }),
  addSettlement: (settlement) =>
    set((s) => ({ settlements: [...s.settlements, settlement] })),

  addReceipt: (receipt) =>
    set((s) => {
      if (s.receipts.find((r) => r.id === receipt.id)) return s
      return { receipts: [receipt, ...s.receipts] }
    }),

  updateReceipt: (receipt) =>
    set((s) => ({
      receipts: s.receipts.map((r) => (r.id === receipt.id ? receipt : r)),
    })),

  removeReceipt: (id) =>
    set((s) => ({ receipts: s.receipts.filter((r) => r.id !== id) })),

  updateMember: (id, patch) =>
    set((s) => ({ members: s.members.map((m) => m.id === id ? { ...m, ...patch } : m) })),

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  reset: () => set(defaultGroupState),
}))
