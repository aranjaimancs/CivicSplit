import { useState } from 'react'
import { clsx } from 'clsx'
import type { DraftLineItem, Member, SplitType } from '../types'
import { fmt } from '../lib/calculations'

interface Props {
  item: DraftLineItem
  members: Member[]
  memberCount: number
  onChange: (updated: DraftLineItem) => void
  onRemove: () => void
}

const TYPE_CONFIG: Record<SplitType, { label: string; active: string; dot: string }> = {
  shared:   { label: 'Shared',   active: 'bg-indigo-500 text-white',  dot: 'bg-indigo-400' },
  personal: { label: 'Personal', active: 'bg-amber-500 text-white',   dot: 'bg-amber-400'  },
  custom:   { label: 'Custom',   active: 'bg-violet-500 text-white',  dot: 'bg-violet-400' },
}

const ACCENT: Record<SplitType, string> = {
  shared:   'bg-indigo-400',
  personal: 'bg-amber-400',
  custom:   'bg-violet-400',
}

export function LineItemRow({ item, members, memberCount, onChange, onRemove }: Props) {
  const [showCustomModal, setShowCustomModal] = useState(false)

  const price = parseFloat(item.price) || 0
  const shareEach = memberCount > 0 ? price / memberCount : 0
  const customTotal = Object.values(item.custom_splits).reduce(
    (s, v) => s + (parseFloat(v) || 0),
    0
  )
  const customRemaining = price - customTotal

  // Did the user change from AI suggestion?
  const aiChanged = item.aiSuggested && item.aiSuggested !== item.split_type

  function handleSplitType(t: SplitType) {
    if (t === 'custom') setShowCustomModal(true)
    onChange({ ...item, split_type: t })
  }

  return (
    <>
      <div className="card overflow-hidden animate-slide-up">
        <div className="flex">
          <div className={clsx('w-1 flex-shrink-0 rounded-l-2xl', ACCENT[item.split_type])} />

          <div className="flex-1 space-y-2 p-3">
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

            <div className="flex flex-wrap items-center gap-1.5">
              {(['shared', 'personal', 'custom'] as SplitType[]).map((t) => {
                const c = TYPE_CONFIG[t]
                const isActive = item.split_type === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleSplitType(t)}
                    className={clsx(
                      'rounded-lg px-3 py-1 text-xs font-semibold transition-all',
                      isActive ? c.active : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    )}
                  >
                    {c.label}
                  </button>
                )
              })}

              {item.split_type === 'shared' && price > 0 && (
                <span className="amount ml-1 text-xs text-slate-400">{fmt(shareEach)}/ea</span>
              )}
              {item.split_type === 'custom' && price > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCustomModal(true)}
                  className="ml-1 text-xs font-semibold text-violet-600"
                >
                  Edit splits →
                </button>
              )}
            </div>

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

      {/* Custom split bottom sheet */}
      {showCustomModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowCustomModal(false)}
        >
          <div className="w-full max-w-[480px] space-y-4 rounded-t-3xl border border-slate-100 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-slide-up shadow-2xl">
            <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-slate-200" />
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Custom split</h3>
                <p className="mt-0.5 text-xs text-slate-500">{item.name || 'Item'}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500"
              >
                ×
              </button>
            </div>

            {price > 0 && (
              <div>
                <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                  <span>
                    Assigned: <span className="amount font-semibold text-slate-700">{fmt(customTotal)}</span>
                  </span>
                  <span
                    className={clsx(
                      'font-semibold',
                      Math.abs(customRemaining) > 0.005 ? 'text-amber-600' : 'text-emerald-600'
                    )}
                  >
                    {Math.abs(customRemaining) > 0.005
                      ? customRemaining > 0
                        ? `${fmt(customRemaining)} left`
                        : `${fmt(-customRemaining)} over`
                      : '✓ Fully assigned'}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={clsx('h-full rounded-full transition-all', customTotal > price ? 'bg-red-400' : 'bg-violet-500')}
                    style={{ width: `${Math.min((customTotal / price) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="max-h-[45vh] space-y-3 overflow-y-auto">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: m.avatar_color }}
                  >
                    {m.display_name[0].toUpperCase()}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{m.display_name}</span>
                  <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-sm text-slate-400">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="amount w-16 border-0 bg-transparent text-right text-sm text-slate-900 focus:outline-none focus:ring-0"
                      placeholder="0.00"
                      value={item.custom_splits[m.id] ?? ''}
                      onChange={(e) =>
                        onChange({ ...item, custom_splits: { ...item.custom_splits, [m.id]: e.target.value } })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            <button type="button" onClick={() => setShowCustomModal(false)} className="btn-primary mt-1">
              Done
            </button>
          </div>
        </div>
      )}
    </>
  )
}
