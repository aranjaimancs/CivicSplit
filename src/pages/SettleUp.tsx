import { useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useGroupStore } from '../store'
import { useSessionStore } from '../store'
import { useBalances } from '../hooks/useBalances'
import { NavBar } from '../components/NavBar'
import { MemberAvatar } from '../components/MemberAvatar'
import { fmt, venmoLink } from '../lib/calculations'
import type { Transaction } from '../types'

export function SettleUp() {
  const { joinCode } = useParams<{ joinCode: string }>()
  const { group, members } = useGroupStore()
  const { getMemberId } = useSessionStore()
  const currentMemberId = getMemberId(joinCode ?? '')
  const { balances, transactions } = useBalances()
  const [settledIds, setSettledIds] = useState<Set<string>>(new Set())
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const [editingVenmo, setEditingVenmo] = useState(false)
  const [venmoHandle, setVenmoHandle] = useState('')
  const [savingVenmo, setSavingVenmo] = useState(false)
  const currentMember = members.find((m) => m.id === currentMemberId)

  async function handleMarkPaid(tx: Transaction) {
    const txKey = `${tx.from.id}->${tx.to.id}`
    setLoadingId(txKey)
    try {
      const { data, error } = await supabase
        .from('settlements')
        .insert({
          group_id: group!.id,
          from_member: tx.from.id,
          to_member: tx.to.id,
          amount: tx.amount,
          is_settled: true,
          settled_at: new Date().toISOString(),
        })
        .select()
        .single()
      if (error) throw error

      // Push into the store so balances recalculate immediately
      useGroupStore.getState().addSettlement(data)
      setSettledIds((prev) => new Set([...prev, txKey]))
      toast.success(`Marked ${fmt(tx.amount)} as paid ✓`)
    } catch {
      toast.error('Failed to record settlement')
    } finally {
      setLoadingId(null)
    }
  }

  async function saveVenmo(e: React.FormEvent) {
    e.preventDefault()
    if (!currentMemberId) return
    setSavingVenmo(true)
    try {
      const handle = venmoHandle.replace('@', '').trim()
      await supabase.from('members').update({ venmo_handle: handle }).eq('id', currentMemberId)
      useGroupStore.setState((s) => ({
        members: s.members.map((m) => (m.id === currentMemberId ? { ...m, venmo_handle: handle } : m)),
      }))
      toast.success('Venmo handle saved')
      setEditingVenmo(false)
    } catch {
      toast.error('Failed to save Venmo handle')
    } finally {
      setSavingVenmo(false)
    }
  }

  const myBalance = balances.find((b) => b.member.id === currentMemberId)
  const allSettled = transactions.length === 0

  return (
    <div className="min-h-screen bg-app-bg pb-36 animate-fade-in">
      <header className="page-header">
        <h1 className="text-xl font-bold text-slate-900">Settle up</h1>
        {group && <p className="mt-0.5 text-sm text-slate-500">{group.name}</p>}
      </header>

      <div className="space-y-4 px-4 pt-4">
        {myBalance && (
          <div
            className={[
              'rounded-2xl border p-5 shadow-card-lift',
              myBalance.net > 0.005
                ? 'border-emerald-200/80 bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                : myBalance.net < -0.005
                ? 'border-rose-200/80 bg-gradient-to-br from-rose-500 to-rose-600 text-white'
                : 'border-slate-200 bg-white text-slate-900',
            ].join(' ')}
          >
            <p
              className={[
                'text-[10px] font-bold uppercase tracking-wider',
                Math.abs(myBalance.net) <= 0.005 ? 'text-slate-500' : 'text-white/75',
              ].join(' ')}
            >
              Your balance
            </p>
            <p className="amount mt-1 text-4xl font-bold">
              {myBalance.net > 0.005
                ? `+${fmt(myBalance.net)}`
                : myBalance.net < -0.005
                ? fmt(myBalance.net)
                : '$0.00'}
            </p>
            <p
              className={[
                'mt-2 text-sm font-medium',
                Math.abs(myBalance.net) <= 0.005 ? 'text-slate-600' : 'text-white/85',
              ].join(' ')}
            >
              {myBalance.net > 0.005
                ? `Group owes you ${fmt(myBalance.net)}`
                : myBalance.net < -0.005
                ? `You owe ${fmt(-myBalance.net)} total`
                : 'Everyone is even.'}
            </p>
          </div>
        )}

        {allSettled ? (
          <div className="card flex flex-col items-center px-6 py-12 text-center shadow-card-lift">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">✓</div>
            <p className="text-lg font-bold text-slate-900">All settled</p>
            <p className="mt-1 text-sm text-slate-500">No payments needed right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="px-1 text-xs font-bold uppercase tracking-wider text-slate-500">Suggested payments</p>
            {transactions.map((tx) => {
              const txKey = `${tx.from.id}->${tx.to.id}`
              const isSettled = settledIds.has(txKey)
              const isLoading = loadingId === txKey
              const isMyPayment = tx.from.id === currentMemberId
              const isMyReceipt = tx.to.id === currentMemberId
              const toVenmo = tx.to.venmo_handle

              return (
                <div
                  key={txKey}
                  className={['card p-4 transition-opacity', isSettled && 'opacity-45'].join(' ')}
                >
                  <div className="flex items-center gap-3">
                    <MemberAvatar member={tx.from} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold text-slate-900">
                          {tx.from.id === currentMemberId ? 'You' : tx.from.display_name}
                        </span>
                        <ArrowIcon className="h-4 w-4 shrink-0 text-slate-300" />
                        <span className="text-sm font-semibold text-slate-900">
                          {tx.to.id === currentMemberId ? 'You' : tx.to.display_name}
                        </span>
                      </div>
                      <p className="amount mt-1 text-[1.35rem] font-bold leading-tight text-slate-900">{fmt(tx.amount)}</p>
                    </div>
                    <MemberAvatar member={tx.to} size="md" />
                  </div>

                  {!isSettled && (
                    <div className="mt-4 flex gap-2">
                      {isMyPayment && toVenmo && (
                        <a
                          href={venmoLink(toVenmo, tx.amount, `CivicSplit – ${group?.name ?? ''}`)}
                          className="flex-1 rounded-xl bg-[#008CFF] py-2.5 text-center text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.98]"
                        >
                          Pay with Venmo
                        </a>
                      )}
                      {(isMyPayment || isMyReceipt) && (
                        <button
                          type="button"
                          onClick={() => handleMarkPaid(tx)}
                          disabled={isLoading}
                          className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                        >
                          {isLoading ? '…' : 'Mark paid'}
                        </button>
                      )}
                    </div>
                  )}

                  {isSettled && (
                    <div className="mt-3 flex items-center justify-center gap-1.5 text-sm font-semibold text-emerald-600">
                      <span>✓</span> Recorded
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Venmo</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {currentMember?.venmo_handle ? `@${currentMember.venmo_handle}` : 'Add your @handle for one-tap pay'}
              </p>
            </div>
            {!editingVenmo && (
              <button
                type="button"
                onClick={() => {
                  setVenmoHandle(currentMember?.venmo_handle ?? '')
                  setEditingVenmo(true)
                }}
                className="shrink-0 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-bold text-primary-700"
              >
                {currentMember?.venmo_handle ? 'Edit' : 'Add'}
              </button>
            )}
          </div>
          {editingVenmo && (
            <form onSubmit={saveVenmo} className="mt-3 flex flex-wrap items-center gap-2">
              <input
                className="input-filled min-w-0 flex-1"
                placeholder="@handle"
                value={venmoHandle}
                onChange={(e) => setVenmoHandle(e.target.value)}
                autoFocus
              />
              <button type="submit" disabled={savingVenmo} className="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {savingVenmo ? '…' : 'Save'}
              </button>
              <button type="button" onClick={() => setEditingVenmo(false)} className="px-2 text-slate-400 hover:text-slate-600">
                ×
              </button>
            </form>
          )}
        </div>
      </div>

      <NavBar joinCode={joinCode ?? ''} />
    </div>
  )
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  )
}
