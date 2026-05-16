import { useMemo, useState } from 'react'
import { fmt, computeBalances } from '../lib/calculations'
import type { Group, Member, Receipt } from '../types'

type Period = 'week' | 'day' | 'month'

interface Props {
  group: Group
  receipts: Receipt[]
  members: Member[]
  currentMemberId: string
  currentWeek: number
  stipendAmount: number
}

export function BudgetGuide({ group, receipts, members, currentMemberId, currentWeek, stipendAmount }: Props) {
  const [period, setPeriod] = useState<Period>('week')

  const {
    stipendLeft,
    pctUsed,
    plan,
    remaining,
    remainingPeriods,
    periodLabel,
    periodLabelPlural,
  } = useMemo(() => {
    const myOwes = computeBalances(members, receipts)
      .find((b) => b.member.id === currentMemberId)?.owes ?? 0

    const stipend   = stipendAmount
    const weeks     = group.week_count          // e.g. 8
    const totalDays = weeks * 7                 // 56

    // Days elapsed / remaining from group start
    const groupStart   = new Date(group.start_date ?? group.created_at)
    const msElapsed    = Math.max(0, Date.now() - groupStart.getTime())
    const daysElapsed  = Math.floor(msElapsed / (1000 * 60 * 60 * 24))
    const daysLeft     = Math.max(1, totalDays - daysElapsed)
    const weeksLeft    = Math.max(1, Math.ceil(daysLeft / 7))
    // "Month" = 4-week block; 8 weeks = 2 months
    const totalMonths  = Math.ceil(weeks / 4)   // 2
    const monthsLeft   = Math.max(1, Math.ceil(weeksLeft / 4))

    const left = Math.max(0, stipend - myOwes)
    const pct  = Math.min(100, (myOwes / stipend) * 100)

    const configs: Record<Period, {
      plan: number
      remaining: number
      remainingPeriods: number
      periodLabel: string
      periodLabelPlural: string
    }> = {
      week: {
        plan:             stipend / weeks,
        remaining:        left / weeksLeft,
        remainingPeriods: weeksLeft,
        periodLabel:      'week',
        periodLabelPlural: 'weeks',
      },
      day: {
        plan:             stipend / totalDays,
        remaining:        left / daysLeft,
        remainingPeriods: daysLeft,
        periodLabel:      'day',
        periodLabelPlural: 'days',
      },
      month: {
        plan:             stipend / totalMonths,
        remaining:        left / monthsLeft,
        remainingPeriods: monthsLeft,
        periodLabel:      'month',
        periodLabelPlural: 'months',
      },
    }

    return {
      stipendLeft: left,
      pctUsed: pct,
      ...configs[period],
    }
  }, [group, receipts, members, currentMemberId, period])

  // Status: compare remaining-per-period to original plan
  const ratio       = plan > 0 ? remaining / plan : 1
  const isAhead      = ratio >= 0.98          // on or under budget
  const isSlightOver = ratio >= 0.75 && ratio < 0.98

  const statusColor = isAhead ? 'text-emerald-600' : isSlightOver ? 'text-amber-600' : 'text-rose-600'
  const statusBg    = isAhead ? 'bg-emerald-50 ring-emerald-200/60' : isSlightOver ? 'bg-amber-50 ring-amber-200/60' : 'bg-rose-50 ring-rose-200/60'
  const barColor    = isAhead ? '#10b981' : isSlightOver ? '#f59e0b' : '#f43f5e'
  // isOver = !isAhead && !isSlightOver (derived, not a separate variable)
  const statusLabel = isAhead ? 'On budget' : isSlightOver ? 'A bit tight' : 'Over pace'

  const TABS: { key: Period; label: string }[] = [
    { key: 'week',  label: 'Week'  },
    { key: 'day',   label: 'Day'   },
    { key: 'month', label: 'Month' },
  ]

  return (
    <div className="card px-5 pb-5 pt-4 shadow-card-lift">
      {/* Title row */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.09em] text-slate-400">Budget guide</h2>
        <span className={['rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1', statusBg, statusColor].join(' ')}>
          {statusLabel}
        </span>
      </div>

      {/* Period tabs */}
      <div className="mb-4 flex rounded-xl bg-slate-100 p-1">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setPeriod(key)}
            className={[
              'flex-1 rounded-lg py-1.5 text-xs font-bold transition-all',
              period === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Two stats side by side */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        {/* Original plan */}
        <div className="rounded-2xl bg-slate-50 px-3.5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Plan / {periodLabel}
          </p>
          <p className="amount mt-1 text-[1.35rem] font-bold leading-none text-slate-700">
            {fmt(plan)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {fmt(stipendAmount)} ÷ {group.week_count} wks
          </p>
        </div>

        {/* Forward-looking remaining */}
        <div className={[
          'rounded-2xl px-3.5 py-3 ring-1',
          isAhead ? 'bg-emerald-50 ring-emerald-200/60' : isSlightOver ? 'bg-amber-50 ring-amber-200/60' : 'bg-rose-50 ring-rose-200/60',
        ].join(' ')}>
          <p className={['text-[10px] font-bold uppercase tracking-wider', statusColor].join(' ')}>
            Left / {periodLabel}
          </p>
          <p className={['amount mt-1 text-[1.35rem] font-bold leading-none', statusColor].join(' ')}>
            {fmt(remaining)}
          </p>
          <p className={['mt-1 text-[11px]', statusColor, 'opacity-70'].join(' ')}>
            {fmt(stipendLeft)} over {remainingPeriods} {remainingPeriods === 1 ? periodLabel : periodLabelPlural}
          </p>
        </div>
      </div>

      {/* Stipend progress bar */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[11px] font-medium text-slate-500">Stipend used</p>
          <p className="text-[11px] font-bold text-slate-700">
            {fmt(stipendAmount - stipendLeft)} <span className="font-normal text-slate-400">of {fmt(stipendAmount)}</span>
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pctUsed}%`, backgroundColor: barColor }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">
          Week {currentWeek} of {group.week_count} · {fmt(stipendLeft)} remaining
        </p>
      </div>
    </div>
  )
}
