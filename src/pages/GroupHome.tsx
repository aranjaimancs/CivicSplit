import { useParams, Link, useNavigate } from 'react-router-dom'
import { useGroup } from '../hooks/useGroup'
import { useBalances } from '../hooks/useBalances'
import { useRealtime } from '../hooks/useRealtime'
import { useGroupStore } from '../store'
import { useSessionStore } from '../store'
import { BalanceBoard } from '../components/BalanceBoard'
import { ReceiptCard } from '../components/ReceiptCard'
import { NavBar } from '../components/NavBar'
import { fmt } from '../lib/calculations'

export function GroupHome() {
  const { joinCode } = useParams<{ joinCode: string }>()
  const navigate = useNavigate()
  const { group, members, receipts, loading, error } = useGroupStore()
  const { getMemberId } = useSessionStore()
  const currentMemberId = getMemberId(joinCode ?? '')

  useGroup(joinCode)
  useRealtime(group?.id)

  const { balances } = useBalances()
  const myBalance = balances.find((b) => b.member.id === currentMemberId)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="h-11 w-11 animate-pulse rounded-2xl bg-primary-200" />
          <p className="text-sm font-medium text-slate-400">Loading group…</p>
        </div>
      </div>
    )
  }

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

  const week = currentWeek(group.created_at, group.week_count)
  const recentReceipts = receipts.slice(0, 10)
  const totalSpend = receipts.reduce((s, r) => s + Number(r.total), 0)

  return (
    <div className="min-h-screen bg-app-bg pb-36">
      <header className="relative overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-primary-500 px-5 pb-10 pt-14 text-white">
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full bg-black/10 blur-2xl" />

        <div className="relative">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            Week {week} of {group.week_count}
          </div>

          <h1 className="text-[1.65rem] font-bold leading-tight tracking-tight">{group.name}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-black/15 px-2.5 py-1 font-mono text-xs font-bold tracking-widest text-white/95">
              {group.join_code}
            </span>
            <span className="text-xs font-medium text-white/65">
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </span>
            <span className="text-xs font-medium text-white/65">·</span>
            <span className="amount text-xs font-semibold text-white/90">{fmt(totalSpend)} total</span>
          </div>

          {myBalance && Math.abs(myBalance.net) > 0.005 && (
            <div
              className={[
                'mt-5 inline-flex max-w-full flex-wrap items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold',
                myBalance.net > 0
                  ? 'bg-emerald-500/25 text-emerald-50 ring-1 ring-emerald-400/30'
                  : 'bg-rose-500/20 text-rose-50 ring-1 ring-rose-400/25',
              ].join(' ')}
            >
              <span>
                {myBalance.net > 0
                  ? `You're owed ${fmt(myBalance.net)}`
                  : `You owe ${fmt(-myBalance.net)}`}
              </span>
              <Link
                to={`/group/${joinCode}/settle`}
                className="text-xs font-bold text-white/80 underline decoration-white/40 underline-offset-2 hover:text-white"
              >
                Settle up
              </Link>
            </div>
          )}
        </div>
      </header>

      <div className="-mt-6 space-y-6 px-4">
        <section className="card relative z-10 p-4 shadow-card-md">
          <div className="mb-3 flex items-center justify-between px-0.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Balances</h2>
            <Link
              to={`/group/${joinCode}/settle`}
              className="text-xs font-bold text-primary-600 hover:text-primary-700"
            >
              Settle up →
            </Link>
          </div>
          <BalanceBoard balances={balances} currentMemberId={currentMemberId} />
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between px-0.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Recent expenses</h2>
            <Link
              to={`/group/${joinCode}/history`}
              className="text-xs font-bold text-primary-600 hover:text-primary-700"
            >
              All history →
            </Link>
          </div>

          {recentReceipts.length === 0 ? (
            <div className="card flex flex-col items-center px-6 py-12 text-center shadow-card-md">
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
            <div className="space-y-2.5">
              {recentReceipts.map((r) => (
                <ReceiptCard key={r.id} receipt={r} members={members} joinCode={joinCode ?? ''} />
              ))}
            </div>
          )}
        </section>
      </div>

      <NavBar joinCode={joinCode ?? ''} />
    </div>
  )
}

function currentWeek(createdAt: string, weekCount: number): number {
  const start = new Date(createdAt)
  const now = new Date()
  const diff = Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))
  return Math.min(Math.max(diff + 1, 1), weekCount)
}
