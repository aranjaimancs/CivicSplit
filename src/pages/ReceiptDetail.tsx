import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useGroupStore } from '../store'
import { NavBar } from '../components/NavBar'
import { MemberAvatar } from '../components/MemberAvatar'
import { fmt } from '../lib/calculations'
import type { LineItem } from '../types'

const TYPE_STYLE: Record<string, string> = {
  shared:   'bg-slate-100 text-slate-700',
  personal: 'bg-amber-50 text-amber-800',
  custom:   'bg-violet-50 text-violet-800',
}
const TYPE_ACCENT: Record<string, string> = {
  shared:   'bg-slate-400',
  personal: 'bg-amber-400',
  custom:   'bg-violet-500',
}
const TYPE_LABEL: Record<string, string> = {
  shared:   'Split equally',
  personal: 'Personal',
  custom:   'Custom split',
}

export function ReceiptDetail() {
  const { joinCode, id } = useParams<{ joinCode: string; id: string }>()
  const navigate = useNavigate()
  const { receipts, members } = useGroupStore()
  const [deleting, setDeleting] = useState(false)

  const receipt = receipts.find((r) => r.id === id)
  const payer = members.find((m) => m.id === receipt?.paid_by)

  if (!receipt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg">
        <p className="text-sm text-slate-400">Receipt not found</p>
      </div>
    )
  }

  const items: LineItem[] = receipt.line_items ?? []

  async function handleDelete() {
    if (!confirm('Delete this receipt? This cannot be undone.')) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('receipts').delete().eq('id', receipt!.id)
      if (error) throw error
      useGroupStore.getState().removeReceipt(receipt!.id)
      toast.success('Receipt deleted')
      navigate(`/group/${joinCode}`)
    } catch {
      toast.error('Failed to delete receipt')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-app-bg pb-36">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="icon-btn" aria-label="Back">
            <BackIcon />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-slate-900">{receipt.store_name}</h1>
            <p className="text-xs text-slate-500">{format(new Date(receipt.date), 'EEEE, MMMM d, yyyy')}</p>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-50"
          >
            {deleting ? '…' : 'Delete'}
          </button>
        </div>
      </header>

      <div className="space-y-4 px-4 pt-4">
        <div className="card flex items-center gap-4 p-4">
          {payer && <MemberAvatar member={payer} size="lg" />}
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Paid by</p>
            <p className="text-lg font-bold text-slate-900">{payer?.display_name ?? 'Unknown'}</p>
            <p className="mt-0.5 text-sm text-slate-500">
              Total{' '}
              <span className="amount font-semibold text-slate-800">{fmt(receipt.total)}</span>
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="px-1 text-xs font-bold uppercase tracking-wider text-slate-500">Items</p>
          {items.map((item) => (
            <div key={item.id} className="card overflow-hidden">
              <div className="flex">
                <div className={['w-1 flex-shrink-0', TYPE_ACCENT[item.split_type] ?? 'bg-slate-300'].join(' ')} />
                <div className="flex-1 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                      <span
                        className={[
                          'mt-1.5 inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                          TYPE_STYLE[item.split_type] ?? 'bg-slate-100 text-slate-600',
                        ].join(' ')}
                      >
                        {TYPE_LABEL[item.split_type] ?? item.split_type}
                      </span>
                    </div>
                    <p className="amount flex-shrink-0 text-sm font-bold text-slate-900">{fmt(item.price)}</p>
                  </div>

                  {item.split_type === 'shared' && (
                    <p className="mt-1.5 text-xs text-slate-500">
                      <span className="amount font-medium text-slate-600">{fmt(item.price / members.length)}</span> ×{' '}
                      {members.length} people
                    </p>
                  )}

                  {item.split_type === 'custom' && item.splits && item.splits.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                      {item.splits.map((split) => {
                        const member = members.find((m) => m.id === split.member_id)
                        return (
                          <div key={split.id} className="flex justify-between text-xs text-slate-500">
                            <span>{member?.display_name ?? 'Unknown'}</span>
                            <span className="amount font-medium text-slate-700">{fmt(split.amount)}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-primary-600 to-primary-500 px-5 py-4 shadow-lg shadow-primary-600/25">
          <span className="text-sm font-semibold text-white/90">Receipt total</span>
          <span className="amount text-2xl font-bold text-white">{fmt(receipt.total)}</span>
        </div>
      </div>

      <NavBar joinCode={joinCode ?? ''} />
    </div>
  )
}

function BackIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}
