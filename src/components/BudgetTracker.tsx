import { useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useGroupStore } from '../store'
import { fmt } from '../lib/calculations'

interface Props {
  stipend: number
  groupExpenses: number  // member's total cost share from receipts (myBalance.owes)
  memberId: string
  rentAmount: number
}

export function BudgetTracker({ stipend, groupExpenses, memberId, rentAmount }: Props) {
  const { updateMember } = useGroupStore()
  const [editingRent, setEditingRent] = useState(false)
  const [rentInput, setRentInput] = useState(String(rentAmount || ''))
  const [saving, setSaving] = useState(false)

  const rent = rentAmount ?? 0
  const totalUsed = groupExpenses + rent
  const remaining = stipend - totalUsed
  const pctUsed = stipend > 0 ? Math.min((totalUsed / stipend) * 100, 100) : 0

  const barColor =
    pctUsed >= 90 ? 'bg-rose-500' :
    pctUsed >= 70 ? 'bg-amber-400' :
    'bg-emerald-500'

  const remainingColor =
    remaining < 0 ? 'text-rose-600' :
    pctUsed >= 70 ? 'text-amber-600' :
    'text-emerald-600'

  async function saveRent(e: React.FormEvent) {
    e.preventDefault()
    const val = parseFloat(rentInput) || 0
    if (val < 0) { toast.error('Rent cannot be negative'); return }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('members')
        .update({ rent_amount: val })
        .eq('id', memberId)
      if (error) throw error
      updateMember(memberId, { rent_amount: val })
      toast.success('Rent saved')
      setEditingRent(false)
    } catch {
      toast.error('Failed to save rent')
    } finally {
      setSaving(false)
    }
  }

  function startEdit() {
    setRentInput(String(rent || ''))
    setEditingRent(true)
  }

  return (
    <section className="card p-5 shadow-card-lift">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.09em] text-slate-400">
          My Summer Budget
        </h2>
        <span className={`text-[11px] font-bold ${remainingColor}`}>
          {remaining >= 0 ? `${fmt(remaining)} left` : `${fmt(Math.abs(remaining))} over`}
        </span>
      </div>

      {/* Line items */}
      <div className="space-y-2.5">
        <BudgetRow label="Stipend" amount={stipend} sign="+" dimmed={false} />
        <BudgetRow label="Group expenses" amount={groupExpenses} sign="−" dimmed={groupExpenses === 0} />

        {/* Rent row — editable */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-slate-500 shrink-0">−</span>
            <span className="text-sm font-medium text-slate-700 truncate">Rent</span>
          </div>
          {editingRent ? (
            <form onSubmit={saveRent} className="flex items-center gap-2">
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input-filled w-28 py-1.5 pl-6 pr-2 text-right text-sm"
                  value={rentInput}
                  onChange={(e) => setRentInput(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-primary-600 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {saving ? '…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setEditingRent(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ×
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <span className={`amount text-sm font-semibold ${rent === 0 ? 'text-slate-300' : 'text-slate-700'}`}>
                {rent === 0 ? '—' : fmt(rent)}
              </span>
              <button
                type="button"
                onClick={startEdit}
                className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-200"
              >
                {rent === 0 ? 'Add' : 'Edit'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Divider + total */}
      <div className="my-3.5 border-t border-slate-100" />
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-800">Remaining</span>
        <span className={`amount text-lg font-bold ${remainingColor}`}>
          {remaining >= 0 ? fmt(remaining) : `−${fmt(Math.abs(remaining))}`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pctUsed}%` }}
        />
      </div>
      <p className="mt-1.5 text-right text-[11px] font-semibold text-slate-400">
        {fmt(totalUsed)} of {fmt(stipend)} used · {pctUsed.toFixed(0)}%
      </p>
    </section>
  )
}

function BudgetRow({
  label,
  amount,
  sign,
  dimmed,
}: {
  label: string
  amount: number
  sign: '+' | '−'
  dimmed: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-sm font-medium shrink-0 ${dimmed ? 'text-slate-300' : 'text-slate-500'}`}>
          {sign}
        </span>
        <span className={`text-sm font-medium truncate ${dimmed ? 'text-slate-400' : 'text-slate-700'}`}>
          {label}
        </span>
      </div>
      <span className={`amount text-sm font-semibold ${dimmed ? 'text-slate-300' : 'text-slate-700'}`}>
        {dimmed ? '—' : fmt(amount)}
      </span>
    </div>
  )
}
