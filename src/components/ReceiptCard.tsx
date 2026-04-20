import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { MemberAvatar } from './MemberAvatar'
import { fmt } from '../lib/calculations'
import type { Receipt, Member } from '../types'

interface Props {
  receipt: Receipt
  members: Member[]
  joinCode: string
}

function storeInitial(name: string): string {
  const t = name.trim()
  return t ? t[0].toUpperCase() : '?'
}

export function ReceiptCard({ receipt, members, joinCode }: Props) {
  const payer = members.find((m) => m.id === receipt.paid_by)
  const itemCount = receipt.line_items?.length ?? 0
  const sharedCount = receipt.line_items?.filter((i) => i.split_type === 'shared').length ?? 0
  const personalCount = receipt.line_items?.filter((i) => i.split_type === 'personal').length ?? 0

  return (
    <Link to={`/group/${joinCode}/receipt/${receipt.id}`} className="block">
      <div className="card flex items-center gap-3.5 p-4 transition-all active:scale-[0.99] hover:shadow-card-lift">
        <div className="relative shrink-0">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-inner"
            style={{ backgroundColor: payer?.avatar_color ?? '#4F46BB' }}
          >
            {storeInitial(receipt.store_name)}
          </div>
          {payer && (
            <div className="absolute -bottom-1 -right-1 ring-2 ring-white rounded-full">
              <MemberAvatar member={payer} size="xs" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-slate-900">{receipt.store_name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-xs text-slate-500">
              {payer?.display_name ?? '?'} · {format(new Date(receipt.date), 'MMM d')}
            </span>
            {itemCount > 0 && (
              <div className="flex flex-wrap gap-1">
                {sharedCount > 0 && (
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    {sharedCount} shared
                  </span>
                )}
                {personalCount > 0 && (
                  <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    {personalCount} personal
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="amount text-[15px] font-bold text-slate-900">{fmt(receipt.total)}</span>
          <ChevronIcon className="h-5 w-5 text-slate-300" />
        </div>
      </div>
    </Link>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}
