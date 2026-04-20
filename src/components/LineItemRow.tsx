import { clsx } from 'clsx'
import type { DraftLineItem, Member } from '../types'
import { fmt } from '../lib/calculations'

interface Props {
  item: DraftLineItem
  members: Member[]
  onChange: (updated: DraftLineItem) => void
  onRemove: () => void
}

export function LineItemRow({ item, members, onChange, onRemove }: Props) {
  const price = parseFloat(item.price) || 0
  const selected = item.assigned_member_ids
  const selectedCount = selected.length
  const shareEach = selectedCount > 0 && price > 0 ? price / selectedCount : 0

  // Accent bar color mirrors selection state
  const accent =
    selectedCount === members.length ? 'bg-indigo-400'  // all → shared
    : selectedCount === 1            ? 'bg-amber-400'   // one → personal-ish
    :                                  'bg-violet-400'  // subset

  function toggle(memberId: string) {
    const isSelected = selected.includes(memberId)
    // Prevent deselecting the very last person
    if (isSelected && selectedCount === 1) return
    onChange({
      ...item,
      assigned_member_ids: isSelected
        ? selected.filter((id) => id !== memberId)
        : [...selected, memberId],
    })
  }

  function selectAll() {
    onChange({ ...item, assigned_member_ids: members.map((m) => m.id) })
  }

  // Detect if selection changed from the original AI suggestion
  const aiChanged =
    item.aiSuggestedAll !== undefined &&
    (item.aiSuggestedAll ? selectedCount !== members.length : selectedCount !== 1)

  return (
    <div className="card overflow-hidden animate-slide-up">
      <div className="flex">
        {/* Left accent */}
        <div className={clsx('w-1 flex-shrink-0 rounded-l-2xl transition-colors duration-200', accent)} />

        <div className="flex-1 space-y-2.5 p-3">
          {/* ── Row 1: name + price + remove ── */}
          <div className="flex items-center gap-2">
            <input
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
              placeholder="Item name"
              value={item.name}
              onChange={(e) => onChange({ ...item, name: e.target.value })}
            />
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50/80 px-2 py-2">
              <span className="text-sm font-medium text-slate-400">$</span>
              <input
                className="amount w-16 border-0 bg-transparent text-right text-sm text-slate-900 focus:outline-none focus:ring-0"
                placeholder="0.00"
                type="number"
                min="0"
                step="0.01"
                value={item.price}
                onChange={(e) => onChange({ ...item, price: e.target.value })}
              />
            </div>
            <button
              type="button"
              onClick={onRemove}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-lg leading-none text-slate-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500"
            >
              ×
            </button>
          </div>

          {/* ── Row 2: avatar toggles ── */}
          <div className="flex flex-wrap items-center gap-1.5">
            {members.map((m) => {
              const isOn = selected.includes(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  className={clsx(
                    'rounded-full px-2.5 py-1 text-[11px] font-semibold text-white transition-all duration-150 select-none whitespace-nowrap',
                    isOn
                      ? 'scale-105'
                      : 'opacity-30 grayscale scale-95',
                  )}
                  style={{ backgroundColor: isOn ? m.avatar_color : '#94a3b8' }}
                >
                  {m.display_name}
                </button>
              )
            })}

            {/* Per-person cost */}
            {price > 0 && selectedCount > 0 && (
              <span className="ml-0.5 text-xs text-slate-400">
                {selectedCount < members.length && (
                  <span className="font-medium text-slate-500">{selectedCount}/{members.length} · </span>
                )}
                <span className="amount font-semibold text-slate-700">{fmt(shareEach)}</span>
                <span className="text-slate-400">/ea</span>
              </span>
            )}

            {/* Quick "select all" when not everyone is included */}
            {selectedCount < members.length && (
              <button
                type="button"
                onClick={selectAll}
                className="ml-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                all
              </button>
            )}
          </div>

          {/* ── AI reason chip ── */}
          {item.aiReason && (
            <div className="flex items-center gap-1.5">
              <span className="rounded-md bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700">
                ✦ AI: {item.aiReason}
                {aiChanged && ' · changed'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
