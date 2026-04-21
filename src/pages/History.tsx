import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { addWeeks, isWithinInterval, endOfWeek, format } from 'date-fns'
import { useGroupStore } from '../store'
import { useSessionStore } from '../store'
import { NavBar } from '../components/NavBar'
import { ReceiptCard } from '../components/ReceiptCard'
import { fmt, computeBalances } from '../lib/calculations'
import type { WeekSummary } from '../types'

export function History() {
  const { joinCode } = useParams<{ joinCode: string }>()
  const { group, members, receipts } = useGroupStore()
  const { getMemberId } = useSessionStore()
  const currentMemberId = getMemberId(joinCode ?? '')

  const weeks = useMemo<WeekSummary[]>(() => {
    if (!group) return []
    const groupStart = new Date(group.start_date ?? group.created_at)

    return Array.from({ length: group.week_count }, (_, w) => {
      const startDate = addWeeks(groupStart, w)
      const endDate = endOfWeek(startDate, { weekStartsOn: 1 })
      const weekReceipts = receipts.filter((r) =>
        isWithinInterval(new Date(r.date), { start: startDate, end: endDate })
      )
      const totalSpent = weekReceipts.reduce((s, r) => s + Number(r.total), 0)
      const weekBalances = computeBalances(members, weekReceipts)
      const myBalance = weekBalances.find((b) => b.member.id === currentMemberId)
      return { week: w + 1, startDate, endDate, totalSpent, yourShare: myBalance?.owes ?? 0, receipts: weekReceipts }
    }).reverse()
  }, [group, receipts, members, currentMemberId])

  const totalGroupSpend = receipts.reduce((s, r) => s + Number(r.total), 0)

  return (
    <div className="min-h-screen bg-app-bg pb-36 animate-fade-in">
      <header className="page-header">
        <h1 className="text-xl font-bold text-slate-900">History</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {group?.name} · <span className="amount font-medium text-slate-600">{fmt(totalGroupSpend)}</span> ·{' '}
          {receipts.length} {receipts.length === 1 ? 'receipt' : 'receipts'}
        </p>
      </header>

      <div className="page-body space-y-3 pt-4">
        {weeks.length === 0 && (
          <div className="card flex flex-col items-center px-6 py-12 text-center">
            <div className="mb-3 text-4xl">📅</div>
            <p className="font-semibold text-slate-700">No history yet</p>
          </div>
        )}

        {weeks.map((week) => (
          <WeekCard
            key={week.week}
            week={week}
            members={members}
            joinCode={joinCode ?? ''}
            currentMemberId={currentMemberId}
          />
        ))}
      </div>

      <NavBar joinCode={joinCode ?? ''} />
    </div>
  )
}

function WeekCard({
  week,
  members,
  joinCode,
  currentMemberId,
}: {
  week: WeekSummary
  members: ReturnType<typeof useGroupStore.getState>['members']
  joinCode: string
  currentMemberId: string | undefined
}) {
  const [expanded, setExpanded] = useState(false)
  const isEmpty = week.receipts.length === 0

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => !isEmpty && setExpanded(!expanded)}
        className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-slate-50/80"
      >
        <div
          className={[
            'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-lg font-bold',
            isEmpty ? 'bg-slate-100 text-slate-300' : 'bg-primary-100 text-primary-700',
          ].join(' ')}
        >
          {week.week}
        </div>

        <div className="min-w-0 flex-1">
          <p className={['text-[15px] font-semibold', isEmpty ? 'text-slate-300' : 'text-slate-900'].join(' ')}>
            Week {week.week}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {format(week.startDate, 'MMM d')} – {format(week.endDate, 'MMM d')}
            {isEmpty && ' · no spending'}
          </p>
        </div>

        {!isEmpty && (
          <div className="flex flex-shrink-0 items-center gap-1.5 text-right sm:gap-2">
            <div>
              <p className="amount text-[15px] font-bold text-slate-900">{fmt(week.totalSpent)}</p>
              {currentMemberId && (
                <p className="text-[11px] text-slate-400 sm:text-xs">
                  your share{' '}
                  <span className="amount font-semibold text-slate-600">{fmt(week.yourShare)}</span>
                </p>
              )}
            </div>
            <div className={['text-slate-300 transition-transform', expanded && 'rotate-180'].join(' ')}>
              <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        )}
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-slate-100 px-4 pb-4 pt-3 animate-slide-up">
          {week.receipts.map((r) => (
            <ReceiptCard key={r.id} receipt={r} members={members} joinCode={joinCode} />
          ))}
        </div>
      )}
    </div>
  )
}
