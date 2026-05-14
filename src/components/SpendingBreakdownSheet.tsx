import { useMemo, useState } from 'react'
import { addWeeks, endOfWeek, isWithinInterval, format } from 'date-fns'
import { fmt, computeBalances } from '../lib/calculations'
import { RECEIPT_CATEGORIES } from '../types'
import type { Group, Member, Receipt } from '../types'

type Tab = 'week' | 'category' | 'person'

const CATEGORY_EMOJI: Record<string, string> = {
  Groceries:      '🛒',
  Dining:         '🍽️',
  Transportation: '🚗',
  Household:      '🏠',
  Activities:     '🎉',
  Other:          '📦',
}

interface Props {
  group: Group
  receipts: Receipt[]
  members: Member[]
  currentMemberId: string
  onClose: () => void
}

export function SpendingBreakdownSheet({
  group,
  receipts,
  members,
  currentMemberId,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>('week')
  const totalSpend = receipts.reduce((s, r) => s + Number(r.total), 0)

  const TABS: { key: Tab; label: string }[] = [
    { key: 'week',     label: 'Week'     },
    { key: 'category', label: 'Category' },
    { key: 'person',   label: 'Person'   },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-5"
      style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))', paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[440px] rounded-3xl bg-white shadow-2xl animate-slide-up">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pb-1 pt-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Spending breakdown</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              <span className="amount font-semibold text-slate-700">{fmt(totalSpend)}</span>
              {' '}across {receipts.length} {receipts.length === 1 ? 'receipt' : 'receipts'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
            aria-label="Close"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Segmented tabs */}
        <div className="mx-6 mb-4 mt-3 flex rounded-xl bg-slate-100 p-1">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={[
                'flex-1 rounded-lg py-1.5 text-xs font-bold transition-all',
                tab === key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="max-h-[48vh] overflow-y-auto px-6 pb-5">
          {tab === 'week' && (
            <WeekTab
              group={group}
              receipts={receipts}
              members={members}
              currentMemberId={currentMemberId}
            />
          )}
          {tab === 'category' && (
            <CategoryTab receipts={receipts} totalSpend={totalSpend} />
          )}
          {tab === 'person' && (
            <PersonTab
              receipts={receipts}
              members={members}
              currentMemberId={currentMemberId}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Week tab ─────────────────────────────────────────────────────────────────

function WeekTab({
  group,
  receipts,
  members,
  currentMemberId,
}: {
  group: Group
  receipts: Receipt[]
  members: Member[]
  currentMemberId: string
}) {
  const rows = useMemo(() => {
    const groupStart = new Date(group.start_date ?? group.created_at)
    return Array.from({ length: group.week_count }, (_, w) => {
      const startDate = addWeeks(groupStart, w)
      const endDate   = endOfWeek(startDate, { weekStartsOn: 1 })
      const weekReceipts = receipts.filter((r) =>
        isWithinInterval(new Date(r.date), { start: startDate, end: endDate })
      )
      const total   = weekReceipts.reduce((s, r) => s + Number(r.total), 0)
      const balances = computeBalances(members, weekReceipts)
      const myShare  = balances.find((b) => b.member.id === currentMemberId)?.owes ?? 0
      return {
        label:    `Week ${w + 1}`,
        sublabel: `${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d')}`,
        total,
        myShare,
      }
    })
  }, [group, receipts, members, currentMemberId])

  const max = Math.max(...rows.map((r) => r.total), 0.01)

  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <BarRow
          key={r.label}
          label={r.label}
          sublabel={r.sublabel}
          amount={r.total}
          barPct={(r.total / max) * 100}
          detail={r.total > 0 ? `your share ${fmt(r.myShare)}` : 'no spending'}
          empty={r.total === 0}
        />
      ))}
    </div>
  )
}

// ─── Category tab ─────────────────────────────────────────────────────────────

function CategoryTab({
  receipts,
  totalSpend,
}: {
  receipts: Receipt[]
  totalSpend: number
}) {
  const rows = useMemo(() => {
    return RECEIPT_CATEGORIES
      .map((cat) => {
        const catTotal = receipts
          .filter((r) => r.category === cat)
          .reduce((s, r) => s + Number(r.total), 0)
        const count = receipts.filter((r) => r.category === cat).length
        return { cat, total: catTotal, count }
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [receipts])

  const max = Math.max(...rows.map((r) => r.total), 0.01)

  if (rows.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <BarRow
          key={r.cat}
          emoji={CATEGORY_EMOJI[r.cat]}
          label={r.cat}
          sublabel={`${r.count} ${r.count === 1 ? 'receipt' : 'receipts'}`}
          amount={r.total}
          barPct={(r.total / max) * 100}
          detail={totalSpend > 0 ? `${((r.total / totalSpend) * 100).toFixed(0)}% of total` : ''}
        />
      ))}
    </div>
  )
}

// ─── Person tab ───────────────────────────────────────────────────────────────

function PersonTab({
  receipts,
  members,
  currentMemberId,
}: {
  receipts: Receipt[]
  members: Member[]
  currentMemberId: string
}) {
  const rows = useMemo(() => {
    return members
      .map((m) => {
        const paid  = receipts
          .filter((r) => r.paid_by === m.id)
          .reduce((s, r) => s + Number(r.total), 0)
        const count = receipts.filter((r) => r.paid_by === m.id).length
        return { member: m, paid, count }
      })
      .sort((a, b) => b.paid - a.paid)
  }, [receipts, members])

  const max = Math.max(...rows.map((r) => r.paid), 0.01)

  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <BarRow
          key={r.member.id}
          label={
            r.member.id === currentMemberId
              ? `${r.member.display_name} (you)`
              : r.member.display_name
          }
          sublabel={`${r.count} ${r.count === 1 ? 'receipt' : 'receipts'} fronted`}
          amount={r.paid}
          barPct={(r.paid / max) * 100}
          barColor={r.member.avatar_color}
          detail={r.paid === 0 ? 'nothing paid yet' : undefined}
          empty={r.paid === 0}
        />
      ))}
    </div>
  )
}

// ─── Shared bar row ───────────────────────────────────────────────────────────

function BarRow({
  emoji,
  label,
  sublabel,
  amount,
  barPct,
  barColor,
  detail,
  empty,
}: {
  emoji?: string
  label: string
  sublabel?: string
  amount: number
  barPct: number
  barColor?: string
  detail?: string
  empty?: boolean
}) {
  return (
    <div className={empty ? 'opacity-40' : ''}>
      {/* Label row */}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {emoji && <span className="shrink-0 text-[15px] leading-none">{emoji}</span>}
          <span className="truncate text-[13px] font-semibold text-slate-800">{label}</span>
          {sublabel && (
            <span className="shrink-0 text-[11px] text-slate-400">{sublabel}</span>
          )}
        </div>
        <span className="amount shrink-0 text-[13px] font-bold text-slate-900">
          {fmt(amount)}
        </span>
      </div>

      {/* Bar */}
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${barPct}%`,
            backgroundColor: barColor ?? '#4F46BB',
          }}
        />
      </div>

      {/* Detail line below bar */}
      {detail && (
        <p className="mt-1 text-[11px] text-slate-400">{detail}</p>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="py-12 text-center">
      <p className="text-sm font-medium text-slate-400">No receipts yet</p>
      <p className="mt-1 text-xs text-slate-300">Add an expense to see the breakdown.</p>
    </div>
  )
}
