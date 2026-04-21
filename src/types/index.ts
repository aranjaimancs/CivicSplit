export type SplitType = 'shared' | 'personal' | 'custom'

export interface Group {
  id: string
  name: string
  join_code: string
  week_count: number
  stipend_amount: number
  start_date: string | null
  end_date: string | null
  created_at: string
}

export interface Member {
  id: string
  group_id: string
  user_id: string
  display_name: string
  avatar_color: string
  venmo_handle?: string | null
  rent_amount?: number | null
  created_at: string
}

export const RECEIPT_CATEGORIES = [
  'Groceries',
  'Dining',
  'Transportation',
  'Household',
  'Activities',
  'Other',
] as const

export type ReceiptCategory = typeof RECEIPT_CATEGORIES[number]

export interface Receipt {
  id: string
  group_id: string
  paid_by: string
  store_name: string
  category: ReceiptCategory
  date: string
  total: number
  created_at: string
  paid_by_member?: Member
  line_items?: LineItem[]
}

export interface LineItem {
  id: string
  receipt_id: string
  name: string
  price: number
  split_type: SplitType
  created_at: string
  splits?: LineItemSplit[]
}

export interface LineItemSplit {
  id: string
  line_item_id: string
  member_id: string
  amount: number
}

export interface Settlement {
  id: string
  group_id: string
  from_member: string
  to_member: string
  amount: number
  is_settled: boolean
  settled_at: string | null
  created_at: string
  from_member_data?: Member
  to_member_data?: Member
}

export interface MemberBalance {
  member: Member
  paid: number
  owes: number
  net: number
  personal: number
}

export interface Transaction {
  from: Member
  to: Member
  amount: number
}

export interface DraftLineItem {
  id: string
  name: string
  price: string
  /** Member IDs who split this item equally. Defaults to all members (= shared). */
  assigned_member_ids: string[]
  aiReason?: string
  /** true when OCR originally suggested all members; false when it suggested personal */
  aiSuggestedAll?: boolean
}

export interface WeekSummary {
  week: number
  startDate: Date
  endDate: Date
  totalSpent: number
  yourShare: number
  receipts: Receipt[]
}

export interface LocalSession {
  userId: string
  groups: Record<string, string>
}
