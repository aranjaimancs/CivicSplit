import { useNavigate } from 'react-router-dom'
import { fmt, venmoLink } from '../lib/calculations'
import type { Transaction, Group } from '../types'

interface Props {
  group: Group
  week: number
  joinCode: string
  transactions: Transaction[]
  currentMemberId: string
  onDismiss: () => void
}

export function SettleUpSunday({ group, week, joinCode, transactions, currentMemberId, onDismiss }: Props) {
  const navigate = useNavigate()

  // Only the legs of the debt graph that involve the current user
  const mine = transactions.filter(
    (tx) => tx.from.id === currentMemberId || tx.to.id === currentMemberId
  )

  const owing  = mine.filter((tx) => tx.from.id === currentMemberId) // I owe someone
  const owed   = mine.filter((tx) => tx.to.id   === currentMemberId) // someone owes me

  function goSettle() {
    onDismiss()
    navigate(`/group/${joinCode}/settle`)
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onDismiss()}
    >
      {/* Sheet */}
      <div className="w-full max-w-[480px] rounded-t-3xl bg-white shadow-2xl animate-slide-up pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {/* Handle */}
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-slate-200" />

        {/* Hero */}
        <div className="px-6 pb-2 pt-5 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-4xl shadow-sm ring-1 ring-amber-100">
            🌅
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Settle Up Sunday!</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            Let's clear the boards for{' '}
            <span className="font-semibold text-slate-700">
              {group.name} · Week {week}
            </span>
          </p>
        </div>

        {/* Divider */}
        <div className="mx-6 my-4 h-px bg-slate-100" />

        {/* Transactions */}
        <div className="max-h-[40vh] space-y-2.5 overflow-y-auto px-5">
          {owing.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">You owe</p>
              {owing.map((tx) => (
                <TxRow
                  key={`${tx.from.id}->${tx.to.id}`}
                  tx={tx}
                  direction="out"
                  groupName={group.name}
                />
              ))}
            </div>
          )}

          {owed.length > 0 && (
            <div className={owing.length > 0 ? 'mt-4' : ''}>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Owed to you</p>
              {owed.map((tx) => (
                <TxRow
                  key={`${tx.from.id}->${tx.to.id}`}
                  tx={tx}
                  direction="in"
                  groupName={group.name}
                />
              ))}
            </div>
          )}
        </div>

        {/* CTAs */}
        <div className="space-y-2.5 px-5 pt-5">
          <button
            type="button"
            onClick={goSettle}
            className="w-full rounded-2xl bg-primary-600 py-4 text-[15px] font-bold text-white shadow-md shadow-primary-600/25 transition-all hover:bg-primary-700 active:scale-[0.98]"
          >
            Settle up now →
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 text-[14px] font-semibold text-slate-500 transition-colors hover:bg-slate-50 active:scale-[0.98]"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Individual transaction row ────────────────────────────────────────────────

function TxRow({
  tx,
  direction,
  groupName,
}: {
  tx: Transaction
  direction: 'in' | 'out'
  groupName: string
}) {
  const other = direction === 'out' ? tx.to : tx.from
  const toVenmo = direction === 'out' ? tx.to.venmo_handle : null

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-3">
      {/* Avatar */}
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: other.avatar_color }}
      >
        {other.display_name[0].toUpperCase()}
      </div>

      {/* Label */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800 truncate">
          {direction === 'out' ? `Pay ${other.display_name}` : `${other.display_name} pays you`}
        </p>
        <p className="amount text-base font-bold text-slate-900">{fmt(tx.amount)}</p>
      </div>

      {/* Action */}
      {direction === 'out' && toVenmo ? (
        <a
          href={venmoLink(toVenmo, tx.amount, `BudgetSplit – ${groupName}`)}
          className="shrink-0 rounded-xl bg-[#008CFF] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-transform active:scale-95"
        >
          Venmo
        </a>
      ) : direction === 'out' ? (
        <span className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-400">
          No Venmo
        </span>
      ) : (
        <span className="shrink-0 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/60">
          Incoming
        </span>
      )}
    </div>
  )
}
