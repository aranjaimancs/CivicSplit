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
    <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
      {balances.map((b) => {
        const isPositive = b.net > 0.005
        const isNegative = b.net < -0.005
        const isMe = b.member.id === currentMemberId

        return (
          <div
            key={b.member.id}
            className={[
              'flex w-[118px] flex-shrink-0 flex-col gap-2.5 rounded-2xl border p-3.5 transition-transform active:scale-[0.98]',
              isMe ? 'border-primary-300 bg-primary-50/80 ring-2 ring-primary-400/30' : 'border-slate-200/90 bg-white shadow-sm',
              !isMe && isPositive && 'border-emerald-200/80 bg-emerald-50/50',
              !isMe && isNegative && 'border-rose-200/80 bg-rose-50/50',
            ].join(' ')}
          >
            <MemberAvatar member={b.member} size="md" ring={isMe} />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold leading-tight text-slate-900">
                {isMe ? 'You' : b.member.display_name}
              </div>
              <div
                className={[
                  'amount mt-1 text-[15px] font-bold',
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
  )
}
