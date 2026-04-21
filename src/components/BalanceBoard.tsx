import { MemberAvatar } from './MemberAvatar'
import { fmt } from '../lib/calculations'
import type { MemberBalance } from '../types'

interface Props {
  balances: MemberBalance[]
  currentMemberId?: string
}

export function BalanceBoard({ balances, currentMemberId }: Props) {
  if (balances.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 py-10 text-center text-sm text-slate-400">
        No members yet
      </div>
    )
  }

  return (
    <div className="relative -mx-1">
      <div className="flex gap-2.5 overflow-x-auto px-1 pt-1 pb-2 no-scrollbar">
      {balances.map((b) => {
        const isPositive = b.net > 0.005
        const isNegative = b.net < -0.005
        const isMe = b.member.id === currentMemberId

        return (
          <div
            key={b.member.id}
            className={[
              'flex w-[120px] flex-shrink-0 flex-col gap-2.5 rounded-2xl p-3.5 transition-transform active:scale-[0.98] sm:w-[136px] sm:gap-3 sm:p-4',
              isMe
                ? 'bg-primary-50 ring-2 ring-primary-400/40'
                : isPositive
                ? 'bg-emerald-50 ring-1 ring-emerald-200/80'
                : isNegative
                ? 'bg-rose-50 ring-1 ring-rose-200/80'
                : 'bg-white shadow-card ring-1 ring-slate-900/5',
            ].join(' ')}
          >
            <MemberAvatar member={b.member} size="md" ring={isMe} />
            <div className="min-w-0">
              <div className="truncate text-[12px] font-semibold leading-tight text-slate-700 sm:text-[13px]">
                {isMe ? 'You' : b.member.display_name}
              </div>
              <div
                className={[
                  'amount mt-1 text-[1.05rem] font-bold tracking-tight sm:text-xl',
                  isPositive ? 'text-emerald-600' : isNegative ? 'text-rose-600' : 'text-slate-400',
                ].join(' ')}
              >
                {isPositive ? `+${fmt(b.net)}` : isNegative ? fmt(b.net) : 'Even'}
              </div>
            </div>
          </div>
        )
      })}
      </div>
      {/* Scroll fade hint */}
      {balances.length > 3 && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-2xl bg-gradient-to-l from-white to-transparent" />
      )}
    </div>
  )
}
