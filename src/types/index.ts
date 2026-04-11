export type SplitType = 'shared' | 'personal' | 'custom'

export interface Group {
  id: string
  name: string
  join_code: string
  week_count: number
  created_at: string
}

export interface Member {
  id: string
  group_id: string
  user_id: string
  display_name: string
  avatar_color: string
  venmo_handle?: string | null
  created_at: string
}

export interface Receipt {
  id: string
  group_id: string
  paid_by: string
  store_name: string
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
  split_type: SplitType
  custom_splits: Record<string, string>
  aiReason?: string      // set when AI scanned the receipt
  aiSuggested?: SplitType  // the AI's original suggestion (so we can show "changed" state)
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
