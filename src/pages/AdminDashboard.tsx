import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { RECEIPT_CATEGORIES } from '../types'
import type { ReceiptCategory } from '../types'

const ADMIN_KEY = import.meta.env.VITE_ADMIN_PASSCODE ?? 'civic2026'
const STORAGE_KEY = 'civicsplit_admin'

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function fmt$(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtDate(d: string | null | undefined) {
  if (!d) return null
  try { return format(parseISO(d), 'MMM d, yyyy') } catch { return null }
}

/** Escape a value for CSV output */
function csvCell(v: string | number): string {
  const s = String(v)
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

interface SpendStats {
  totalSpend: number
  avgWeeklyPerGroup: number
  highestCohort: { name: string; total: number } | null
}

// Category config shared with stats modal
const CATEGORY_CONFIG: Record<ReceiptCategory, { color: string; bg: string }> = {
  Groceries:     { color: 'text-emerald-700', bg: 'bg-emerald-100' },
  Dining:        { color: 'text-orange-700',  bg: 'bg-orange-100'  },
  Transportation:{ color: 'text-blue-700',    bg: 'bg-blue-100'    },
  Household:     { color: 'text-purple-700',  bg: 'bg-purple-100'  },
  Activities:    { color: 'text-yellow-700',  bg: 'bg-yellow-100'  },
  Other:         { color: 'text-slate-600',   bg: 'bg-slate-100'   },
}

interface AdminGroup {
  id: string
  name: string
  join_code: string
  created_at: string
  week_count: number
  member_count: number
  stipend_amount: number
  start_date: string | null
  end_date: string | null
}

// ─── Root ──────────────────────────────────────────────────────────────────────

export function AdminDashboard() {
  const [authed, setAuthed] = useState(() => localStorage.getItem(STORAGE_KEY) === ADMIN_KEY)

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY)
    setAuthed(false)
  }

  if (!authed) return <AdminLogin onAuth={() => setAuthed(true)} />
  return <AdminPanel onLogout={handleLogout} />
}

// ─── Login ─────────────────────────────────────────────────────────────────────

function AdminLogin({ onAuth }: { onAuth: () => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (value.trim() === ADMIN_KEY) {
      localStorage.setItem(STORAGE_KEY, value.trim())
      onAuth()
    } else {
      setError(true)
      setValue('')
      setTimeout(() => setError(false), 2200)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-3xl shadow-lg">
            🏛️
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin access</h1>
          <p className="mt-1.5 text-sm text-slate-500">Enter your passcode to manage cohorts</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            className={[
              'input-filled py-3.5 text-center font-mono text-base tracking-[0.3em]',
              error ? 'border-rose-400 ring-2 ring-rose-300/30' : '',
            ].join(' ')}
            placeholder="••••••••"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(false) }}
            autoFocus
          />
          {error && (
            <p className="text-center text-sm font-semibold text-rose-600 animate-fade-in">
              Incorrect passcode
            </p>
          )}
          <button type="submit" className="btn-primary">
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          <Link to="/" className="underline decoration-slate-300 underline-offset-2 hover:text-slate-600">
            ← Back to app
          </Link>
        </p>
      </div>
    </div>
  )
}

// ─── Panel ─────────────────────────────────────────────────────────────────────

function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [groups, setGroups] = useState<AdminGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [statsGroup, setStatsGroup] = useState<AdminGroup | null>(null)
  const [spendStats, setSpendStats] = useState<SpendStats | null>(null)
  const [exportLoading, setExportLoading] = useState(false)

  const loadGroups = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: groupData, error: gErr }, { data: memberData }, { data: receiptData }] =
        await Promise.all([
          supabase
            .from('groups')
            .select('id, name, join_code, created_at, week_count, stipend_amount, start_date, end_date')
            .order('created_at', { ascending: true }),
          supabase.from('members').select('id, group_id'),
          supabase.from('receipts').select('group_id, total'),
        ])
      if (gErr) throw gErr

      const counts = (memberData ?? []).reduce<Record<string, number>>((acc, m) => {
        acc[m.group_id] = (acc[m.group_id] ?? 0) + 1
        return acc
      }, {})

      const resolvedGroups = (groupData ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        join_code: g.join_code,
        created_at: g.created_at,
        week_count: g.week_count ?? 8,
        member_count: counts[g.id] ?? 0,
        stipend_amount: g.stipend_amount ?? 1200,
        start_date: g.start_date ?? null,
        end_date: g.end_date ?? null,
      }))
      setGroups(resolvedGroups)

      // ── Compute spend stats from receipt totals ──────────────────────────────
      const totalsMap: Record<string, number> = {}
      for (const r of receiptData ?? []) {
        totalsMap[r.group_id] = (totalsMap[r.group_id] ?? 0) + Number(r.total)
      }

      const totalSpend = Object.values(totalsMap).reduce((s, v) => s + v, 0)

      const weeklyRates = resolvedGroups
        .filter((g) => totalsMap[g.id] !== undefined)
        .map((g) => (totalsMap[g.id] ?? 0) / Math.max(g.week_count, 1))
      const avgWeeklyPerGroup =
        weeklyRates.length > 0
          ? weeklyRates.reduce((s, v) => s + v, 0) / weeklyRates.length
          : 0

      let highestCohort: SpendStats['highestCohort'] = null
      for (const [groupId, total] of Object.entries(totalsMap)) {
        if (!highestCohort || total > highestCohort.total) {
          const g = resolvedGroups.find((g) => g.id === groupId)
          if (g) highestCohort = { name: g.name, total }
        }
      }

      setSpendStats({ totalSpend, avgWeeklyPerGroup, highestCohort })
    } catch {
      toast.error('Failed to load cohorts')
    } finally {
      setLoading(false)
    }
  }, [])

  async function exportCSV() {
    setExportLoading(true)
    try {
      // Fetch full receipt rows + embedded group name/code + all members for payer lookup
      const [{ data: receipts, error: rErr }, { data: members, error: mErr }] = await Promise.all([
        supabase
          .from('receipts')
          .select('date, store_name, category, total, group_id, paid_by, groups(name, join_code)')
          .order('date', { ascending: true }),
        supabase.from('members').select('id, display_name'),
      ])
      if (rErr) throw rErr
      if (mErr) throw mErr

      const memberMap = new Map((members ?? []).map((m) => [m.id, m.display_name]))

      const headers = ['Cohort Name', 'Cohort Code', 'Date', 'Store', 'Category', 'Total ($)', 'Payer']
      const rows = (receipts ?? []).map((r) => {
        const raw = r.groups
        const g = (Array.isArray(raw) ? raw[0] : raw) as { name: string; join_code: string } | null
        return [
          g?.name ?? '',
          g?.join_code ?? '',
          r.date,
          r.store_name,
          r.category ?? 'Other',
          Number(r.total).toFixed(2),
          memberMap.get(r.paid_by) ?? '',
        ]
      })

      const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `civicsplit-summer-${new Date().toISOString().split('T')[0]}.csv`
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success(`${rows.length} receipts exported`)
    } catch {
      toast.error('Export failed')
    } finally {
      setExportLoading(false)
    }
  }

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  function copyAllCodes() {
    if (groups.length === 0) return
    const lines = groups.map((g) => `${g.name}: ${g.join_code}`)
    const text = [
      'CivicSplit Cohort Codes',
      '='.repeat(24),
      ...lines,
      '',
      `Join at: ${window.location.origin}`,
    ].join('\n')
    navigator.clipboard.writeText(text).then(() =>
      toast.success(`${groups.length} codes copied to clipboard`)
    )
  }

  const totalMembers = groups.reduce((s, g) => s + g.member_count, 0)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm shadow-sm">
              🏛️
            </span>
            <div>
              <p className="text-sm font-bold leading-tight text-slate-900">CivicSplit</p>
              <p className="text-[10px] font-bold uppercase leading-tight tracking-widest text-slate-400">
                Admin
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              ← App
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="space-y-5 px-4 pb-12 pt-5">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-900/5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Cohorts</p>
            <p className="mt-1 amount text-3xl font-bold tracking-tight text-slate-900">
              {loading ? '–' : groups.length}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-900/5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Members</p>
            <p className="mt-1 amount text-3xl font-bold tracking-tight text-slate-900">
              {loading ? '–' : totalMembers}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-[0.98]"
          >
            <PlusIcon className="h-4 w-4" />
            New Cohort
          </button>
          <button
            type="button"
            onClick={copyAllCodes}
            disabled={groups.length === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] disabled:opacity-40"
          >
            <CopyIcon className="h-4 w-4" />
            Copy All Codes
          </button>
        </div>

        {/* ── Analytics ── */}
        <div className="space-y-3">
          <p className="px-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Summer Analytics
          </p>

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-2">
            <StatCard
              label="Total Spend"
              value={spendStats ? fmt$(spendStats.totalSpend) : '–'}
              loading={loading}
            />
            <StatCard
              label="Avg/Wk/Group"
              value={spendStats ? fmt$(spendStats.avgWeeklyPerGroup) : '–'}
              loading={loading}
            />
            <StatCard
              label="Top Cohort"
              value={spendStats?.highestCohort?.name ?? '–'}
              sub={spendStats?.highestCohort ? fmt$(spendStats.highestCohort.total) : undefined}
              loading={loading}
            />
          </div>

          {/* Export button */}
          <button
            type="button"
            onClick={exportCSV}
            disabled={exportLoading || loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] disabled:opacity-40"
          >
            <DownloadIcon className="h-4 w-4" />
            {exportLoading ? 'Preparing…' : 'Download Summer Spend Report (CSV)'}
          </button>
        </div>

        {/* Group list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-[110px] w-full rounded-2xl" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
            <p className="text-sm font-semibold text-slate-500">No cohorts yet</p>
            <p className="mt-1 text-xs text-slate-400">Click "New Cohort" to get started</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {groups.map((group) => (
              <GroupRow
                key={group.id}
                group={group}
                onDeleted={loadGroups}
                onViewStats={() => setStatsGroup(group)}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreated={loadGroups} />
      )}

      {statsGroup && (
        <GroupStatsModal group={statsGroup} onClose={() => setStatsGroup(null)} />
      )}
    </div>
  )
}

// ─── Group row ─────────────────────────────────────────────────────────────────

function GroupRow({
  group,
  onDeleted,
  onViewStats,
}: {
  group: AdminGroup
  onDeleted: () => void
  onViewStats: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function copyCode() {
    navigator.clipboard
      .writeText(group.join_code)
      .then(() => toast.success(`${group.name} code copied`))
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const { error } = await supabase.from('groups').delete().eq('id', group.id)
      if (error) throw error
      toast.success(`${group.name} deleted`)
      onDeleted()
    } catch {
      toast.error('Failed to delete cohort')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const dateRange = group.start_date && group.end_date
    ? `${fmtDate(group.start_date)} – ${fmtDate(group.end_date)}`
    : fmtDate(group.start_date) ?? format(new Date(group.created_at), 'MMM d, yyyy')

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-900/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{group.name}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {dateRange} · {fmt$(group.stipend_amount)}/person stipend
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 rounded-xl bg-slate-50 px-3 py-2 text-center font-mono text-base font-bold tracking-[0.3em] text-slate-900 ring-1 ring-slate-200/80 select-all">
          {group.join_code}
        </code>
        <button
          type="button"
          onClick={copyCode}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 active:scale-[0.95]"
          title="Copy code"
        >
          <CopyIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onViewStats}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 active:scale-[0.95]"
          title="View spending summary"
        >
          <ChartIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-400 transition-colors hover:bg-rose-50 hover:text-rose-600 active:scale-[0.95]"
          title="Delete cohort"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Inline delete confirmation */}
      {confirmDelete && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs font-semibold text-rose-800">
            Delete <span className="font-bold">{group.name}</span>? This removes all members, receipts, and settlements permanently.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 rounded-lg bg-rose-600 py-1.5 text-xs font-bold text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
            >
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="flex-1 rounded-lg border border-rose-200 bg-white py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Group stats modal (privacy-safe view) ─────────────────────────────────────

interface ReceiptRow {
  total: number
  category: ReceiptCategory
  date: string
}

function GroupStatsModal({ group, onClose }: { group: AdminGroup; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<ReceiptRow[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('receipts')
        .select('total, category, date')
        .eq('group_id', group.id)
        .order('date', { ascending: true })

      if (error) {
        toast.error('Failed to load stats')
      } else {
        setRows((data ?? []) as ReceiptRow[])
      }
      setLoading(false)
    }
    load()
  }, [group.id])

  const totalSpent = rows.reduce((s, r) => s + Number(r.total), 0)

  // Aggregate by category
  const byCategory = RECEIPT_CATEGORIES.map((cat) => {
    const amount = rows
      .filter((r) => r.category === cat)
      .reduce((s, r) => s + Number(r.total), 0)
    return { cat, amount }
  }).filter((x) => x.amount > 0).sort((a, b) => b.amount - a.amount)

  const maxAmt = byCategory.length > 0 ? byCategory[0].amount : 1

  const dateRange = group.start_date && group.end_date
    ? `${fmtDate(group.start_date)} – ${fmtDate(group.end_date)}`
    : null

  const totalStipend = group.stipend_amount * Math.max(group.member_count, 1)
  const pctUsed = totalStipend > 0 ? Math.min((totalSpent / totalStipend) * 100, 100) : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm animate-fade-in sm:items-center sm:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-t-3xl bg-white p-6 shadow-2xl animate-slide-up sm:rounded-3xl">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-slate-900">{group.name}</h2>
            {dateRange && (
              <p className="mt-0.5 text-xs text-slate-400">{dateRange}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 text-lg"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-8 w-full rounded-xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 py-10 text-center">
            <p className="text-sm font-semibold text-slate-500">No expenses recorded yet</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Stipend progress */}
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/80">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total spent</p>
                  <p className="amount mt-0.5 text-2xl font-bold text-slate-900">{fmt$(totalSpent)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total stipend</p>
                  <p className="amount mt-0.5 text-base font-semibold text-slate-500">{fmt$(totalStipend)}</p>
                  <p className="text-[10px] text-slate-400">{fmt$(group.stipend_amount)}/person</p>
                </div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={[
                    'h-full rounded-full transition-all',
                    pctUsed >= 90 ? 'bg-rose-500' : pctUsed >= 70 ? 'bg-amber-400' : 'bg-emerald-500',
                  ].join(' ')}
                  style={{ width: `${pctUsed}%` }}
                />
              </div>
              <p className="mt-1.5 text-right text-[11px] font-semibold text-slate-400">
                {pctUsed.toFixed(0)}% of stipend used
              </p>
            </div>

            {/* Category breakdown */}
            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Spending by category
              </p>
              <div className="space-y-2.5">
                {byCategory.map(({ cat, amount }) => {
                  const cfg = CATEGORY_CONFIG[cat]
                  const pct = (amount / maxAmt) * 100
                  return (
                    <div key={cat}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${cfg.bg} ${cfg.color}`}>
                          {cat}
                        </span>
                        <span className="amount text-sm font-bold text-slate-700">{fmt$(amount)}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-slate-400 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <p className="text-center text-[11px] text-slate-400">
              {rows.length} {rows.length === 1 ? 'receipt' : 'receipts'} · member details hidden
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Create modal ──────────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [stipendAmount, setStipendAmount] = useState('1200')
  const [saving, setSaving] = useState(false)
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [createdName, setCreatedName] = useState('')

  // Compute week_count from dates for backwards compat
  function computeWeekCount(): number {
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      return Math.max(1, Math.ceil(days / 7))
    }
    return 8
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      toast.error('End date must be after start date')
      return
    }
    setSaving(true)
    try {
      let code = generateJoinCode()
      for (let i = 0; i < 5; i++) {
        const { data: existing } = await supabase
          .from('groups')
          .select('id')
          .eq('join_code', code)
          .maybeSingle()
        if (!existing) break
        code = generateJoinCode()
      }

      const { error } = await supabase.from('groups').insert({
        name: name.trim(),
        join_code: code,
        week_count: computeWeekCount(),
        stipend_amount: Math.max(0, parseFloat(stipendAmount) || 1200),
        start_date: startDate || null,
        end_date: endDate || null,
      })
      if (error) throw error

      setCreatedName(name.trim())
      setGeneratedCode(code)
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create cohort')
      setSaving(false)
    }
  }

  function handleDone() {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode).then(() =>
        toast.success('Code copied!')
      )
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm animate-fade-in sm:items-center sm:p-6"
      onClick={(e) => e.target === e.currentTarget && !generatedCode && onClose()}
    >
      <div className="w-full max-w-sm rounded-t-3xl bg-white p-6 shadow-2xl animate-slide-up sm:rounded-3xl">
        {generatedCode ? (
          /* Success state */
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
              ✓
            </div>
            <h2 className="text-lg font-bold text-slate-900">Cohort created</h2>
            <p className="mt-1 text-sm text-slate-500">{createdName}</p>
            <div className="mt-5 rounded-2xl bg-slate-50 px-5 py-4 ring-1 ring-slate-200/80">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Join code</p>
              <p className="amount mt-1 font-mono text-3xl font-bold tracking-[0.3em] text-slate-900">
                {generatedCode}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDone}
              className="btn-primary mt-5"
            >
              Copy code &amp; close
            </button>
          </div>
        ) : (
          /* Create form */
          <>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">New Cohort</h2>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 text-lg"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  City / Group name
                </label>
                <input
                  className="input-filled py-3.5"
                  placeholder="e.g. Charlotte, Greenwood House"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={60}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Start date
                  </label>
                  <input
                    type="date"
                    className="input-filled py-3"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                    End date
                  </label>
                  <input
                    type="date"
                    className="input-filled py-3"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || undefined}
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Stipend per person ($)
                </label>
                <input
                  type="number"
                  className="input-filled py-3.5"
                  value={stipendAmount}
                  onChange={(e) => setStipendAmount(e.target.value)}
                  min={0}
                  step={50}
                  placeholder="1200"
                />
              </div>

              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Creating…' : 'Create Cohort'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  loading,
}: {
  label: string
  value: string
  sub?: string
  loading?: boolean
}) {
  return (
    <div className="flex flex-col rounded-2xl bg-white p-3 shadow-card ring-1 ring-slate-900/5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-tight">
        {label}
      </p>
      {loading ? (
        <div className="mt-2 h-5 w-3/4 skeleton rounded-lg" />
      ) : (
        <>
          <p className="amount mt-1.5 text-base font-bold leading-tight text-slate-900 break-words">
            {value}
          </p>
          {sub && (
            <p className="amount mt-0.5 text-[11px] font-semibold text-slate-400">{sub}</p>
          )}
        </>
      )}
    </div>
  )
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
      />
    </svg>
  )
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
      />
    </svg>
  )
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  )
}
