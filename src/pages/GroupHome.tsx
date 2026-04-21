import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useGroup } from '../hooks/useGroup'
import { useBalances } from '../hooks/useBalances'
import { useRealtime } from '../hooks/useRealtime'
import { useGroupStore } from '../store'
import { useSessionStore } from '../store'
import { BalanceBoard } from '../components/BalanceBoard'
import { ReceiptCard } from '../components/ReceiptCard'
import { NavBar } from '../components/NavBar'
import { GroupHomeSkeleton } from '../components/SkeletonScreen'
import { SettleUpSunday } from '../components/SettleUpSunday'
import { BudgetTracker } from '../components/BudgetTracker'
import { fmt } from '../lib/calculations'
import { isSunday, hasDismissedThisSunday, dismissThisSunday } from '../lib/sunday'

export function GroupHome() {
  const { joinCode } = useParams<{ joinCode: string }>()
  const navigate = useNavigate()
  const { group, members, receipts, loading, error } = useGroupStore()
  const { getMemberId } = useSessionStore()
  const currentMemberId = getMemberId(joinCode ?? '')

  useGroup(joinCode)
  useRealtime(group?.id)

  const { balances, transactions } = useBalances()
  const myBalance = balances.find((b) => b.member.id === currentMemberId)

  const [sundayDismissed, setSundayDismissed] = useState(false)

  function handleSundayDismiss() {
    dismissThisSunday(joinCode ?? '')
    setSundayDismissed(true)
  }

  if (loading) return <GroupHomeSkeleton />

  if (error || !group) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-app-bg p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-3xl">!</div>
        <p className="text-center text-sm font-medium text-rose-600">{error ?? 'Group not found'}</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm font-semibold text-primary-600 underline decoration-primary-300 underline-offset-2"
        >
          Go home
        </button>
      </div>
    )
  }

  if (!currentMemberId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-app-bg p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-2xl font-bold text-primary-600">
          Hi
        </div>
        <p className="font-semibold text-slate-800">You're not in this group yet</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-primary-600/25"
        >
          Join group
        </button>
      </div>
    )
  }

  const week = currentWeek(group.start_date ?? group.created_at, group.week_count)
  const recentReceipts = receipts.slice(0, 10)
  const totalSpend = receipts.reduce((s, r) => s + Number(r.total), 0)

  const showSundayModal =
    !sundayDismissed &&
    isSunday() &&
    !hasDismissedThisSunday(joinCode ?? '') &&
    Math.abs(myBalance?.net ?? 0) > 0.005

  function copyJoinCode() {
    navigator.clipboard.writeText(group!.join_code).then(() => toast.success('Join code copied!'))
  }

  return (
    <div className="min-h-screen bg-app-bg pb-36 animate-fade-in">
      <header className="relative overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500 px-5 pb-10 pt-14 text-white">
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full bg-black/10 blur-2xl" />

        <div className="relative mx-auto max-w-4xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            Week {week} of {group.week_count}
          </div>

          <h1 className="text-[2rem] font-bold leading-tight tracking-tight">{group.name}</h1>

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyJoinCode}
              className="flex items-center gap-1.5 rounded-lg bg-black/20 px-2.5 py-1 font-mono text-xs font-bold tracking-widest text-white/95 transition-opacity hover:bg-black/30 active:scale-[0.97]"
              title="Copy join code"
            >
              {group.join_code}
              <CopyIcon className="h-3 w-3 opacity-60" />
            </button>
            <span className="text-xs font-medium text-white/60">
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </span>
            <span className="text-xs text-white/40">·</span>
            <span className="amount text-xs font-semibold text-white/80">{fmt(totalSpend)} total</span>
          </div>

          {myBalance && (
            <div className="mt-5 rounded-2xl bg-white/[0.13] px-5 py-4 ring-1 ring-white/[0.18] backdrop-blur-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/60">
                    {myBalance.net > 0.005 ? "You're owed" : myBalance.net < -0.005 ? "You owe" : "Your balance"}
                  </p>
                  <p className="amount mt-1 text-[2.25rem] font-bold tracking-tight text-white leading-none">
                    {Math.abs(myBalance.net) < 0.005 ? '$0.00' : fmt(Math.abs(myBalance.net))}
                  </p>
                  <p className="mt-1.5 text-[13px] font-medium text-white/60">
                    {myBalance.net > 0.005
                      ? 'from the group'
                      : myBalance.net < -0.005
                      ? 'to the group'
                      : 'all settled up'}
                  </p>
                </div>
                {Math.abs(myBalance.net) > 0.005 && (
                  <Link
                    to={`/group/${joinCode}/settle`}
                    className="shrink-0 self-center rounded-xl bg-white/20 px-4 py-2 text-[13px] font-bold text-white ring-1 ring-white/25 transition-colors hover:bg-white/30 active:scale-[0.97]"
                  >
                    Settle
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="page-body -mt-6 space-y-6">
        {myBalance && currentMemberId && (
          <BudgetTracker
            stipend={group.stipend_amount}
            groupExpenses={myBalance.owes}
            memberId={currentMemberId}
            rentAmount={members.find(m => m.id === currentMemberId)?.rent_amount ?? 0}
          />
        )}

        <section className="card relative z-10 p-5 shadow-card-lift">
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.09em] text-slate-400">Balances</h2>
            <Link
              to={`/group/${joinCode}/settle`}
              className="text-[13px] font-bold text-primary-600 hover:text-primary-700"
            >
              Settle up →
            </Link>
          </div>
          <BalanceBoard balances={balances} currentMemberId={currentMemberId} />
        </section>

        <section>
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.09em] text-slate-400">Recent expenses</h2>
            <Link
              to={`/group/${joinCode}/history`}
              className="text-[13px] font-bold text-primary-600 hover:text-primary-700"
            >
              All history →
            </Link>
          </div>

          {recentReceipts.length === 0 ? (
            <div className="card flex flex-col items-center px-6 py-12 text-center shadow-card-lift">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                🧾
              </div>
              <p className="font-semibold text-slate-800">No expenses yet</p>
              <p className="mt-1 text-sm text-slate-500">Add a receipt to split costs with the group.</p>
              <Link
                to={`/group/${joinCode}/add`}
                className="mt-5 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-600/20"
              >
                Add receipt
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentReceipts.map((r) => (
                <ReceiptCard key={r.id} receipt={r} members={members} joinCode={joinCode ?? ''} />
              ))}
            </div>
          )}
        </section>
      </div>

      <NavBar joinCode={joinCode ?? ''} />

      {showSundayModal && (
        <SettleUpSunday
          group={group}
          week={week}
          joinCode={joinCode ?? ''}
          transactions={transactions}
          currentMemberId={currentMemberId}
          onDismiss={handleSundayDismiss}
        />
      )}
    </div>
  )
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
    </svg>
  )
}

function currentWeek(createdAt: string, weekCount: number): number {
  const start = new Date(createdAt)
  const now = new Date()
  const diff = Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))
  return Math.min(Math.max(diff + 1, 1), weekCount)
}
