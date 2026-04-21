import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useGroupStore } from '../store'
import { useSessionStore } from '../store'
import { LineItemRow } from '../components/LineItemRow'
import { NavBar } from '../components/NavBar'
import { isOcrEnabled, parseReceiptImage, checkImageQuality } from '../lib/ocr'
import type { QualityIssue } from '../lib/ocr'
import { round2, fmt } from '../lib/calculations'
import { RECEIPT_CATEGORIES } from '../types'
import type { DraftLineItem, ReceiptCategory } from '../types'

function newItem(memberIds: string[]): DraftLineItem {
  return {
    id: crypto.randomUUID(),
    name: '',
    price: '',
    assigned_member_ids: [...memberIds],
  }
}

export function AddReceipt() {
  const { joinCode } = useParams<{ joinCode: string }>()
  const navigate = useNavigate()
  const { group, members } = useGroupStore()
  const { getMemberId } = useSessionStore()
  const currentMemberId = getMemberId(joinCode ?? '')

  const allMemberIds = members.map((m) => m.id)

  const [storeName, setStoreName] = useState('')
  const [category, setCategory] = useState<ReceiptCategory>('Groceries')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [paidBy, setPaidBy] = useState(currentMemberId ?? '')
  const [items, setItems] = useState<DraftLineItem[]>([newItem(allMemberIds)])
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [aiScanned, setAiScanned] = useState(false)
  const [qualityIssue, setQualityIssue] = useState<{ issue: QualityIssue; message: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const grandTotal = items.reduce((s, i) => s + (parseFloat(i.price) || 0), 0)

  function updateItem(index: number, updated: DraftLineItem) {
    setItems((prev) => prev.map((item, i) => (i === index ? updated : item)))
  }

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Client-side quality gate before hitting the API
    const quality = await checkImageQuality(file)
    if (!quality.ok && quality.issue && quality.message) {
      setQualityIssue({ issue: quality.issue, message: quality.message })
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    setScanning(true)
    try {
      const result = await parseReceiptImage(file)
      if (result.storeName) setStoreName(result.storeName)
      if (result.date) setDate(result.date)
      setItems(
        result.items.map((item) => ({
          id: crypto.randomUUID(),
          name: item.name,
          price: item.price,
          // personal → assign to payer only; shared → everyone
          assigned_member_ids:
            item.split_type === 'personal' && paidBy
              ? [paidBy]
              : [...allMemberIds],
          aiReason: item.aiReason,
          aiSuggestedAll: item.split_type !== 'personal',
        }))
      )
      setAiScanned(true)
      toast.success(`Found ${result.items.length} items`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setScanning(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!group || !paidBy) return

    const validItems = items.filter(
      (i) => i.name.trim() && parseFloat(i.price) > 0 && i.assigned_member_ids.length > 0
    )
    if (validItems.length === 0) {
      toast.error('Add at least one item with a name and price')
      return
    }

    setSaving(true)
    try {
      const total = round2(validItems.reduce((s, i) => s + (parseFloat(i.price) || 0), 0))

      const { data: receipt, error: rErr } = await supabase
        .from('receipts')
        .insert({
          group_id: group.id,
          paid_by: paidBy,
          store_name: storeName.trim() || 'Store',
          category,
          date,
          total,
        })
        .select()
        .single()
      if (rErr) throw rErr

      // Map each item to shared vs custom based on who's assigned
      const resolvedItems = validItems.map((item) => {
        const isAllMembers =
          item.assigned_member_ids.length === members.length &&
          members.every((m) => item.assigned_member_ids.includes(m.id))
        return { ...item, split_type: isAllMembers ? 'shared' : 'custom' } as const
      })

      const { data: lineItems, error: liErr } = await supabase
        .from('line_items')
        .insert(
          resolvedItems.map((i) => ({
            receipt_id: receipt.id,
            name: i.name.trim(),
            price: parseFloat(i.price),
            split_type: i.split_type,
          }))
        )
        .select()
      if (liErr) throw liErr

      // For custom splits: divide price equally among assigned members
      const splitInserts = resolvedItems.flatMap((item, idx) => {
        if (item.split_type !== 'custom') return []
        const li = lineItems[idx]
        if (!li) return []

        const price = parseFloat(item.price)
        const count = item.assigned_member_ids.length
        const base = round2(Math.floor((price * 100) / count) / 100)
        const remainder = round2(price - base * count)

        return item.assigned_member_ids.map((memberId, memberIdx) => ({
          line_item_id: li.id,
          member_id: memberId,
          amount: memberIdx === 0 ? round2(base + remainder) : base,
        }))
      })

      if (splitInserts.length > 0) {
        const { error: sErr } = await supabase.from('line_item_splits').insert(splitInserts)
        if (sErr) throw sErr
      }

      toast.success('Receipt saved!')
      navigate(`/group/${joinCode}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const ocrEnabled = isOcrEnabled()

  return (
    <div className="min-h-screen bg-app-bg pb-36 animate-fade-in">
      {scanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm space-y-4 rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-2xl animate-slide-up">
            <div className="text-5xl">🧾</div>
            <div>
              <p className="text-lg font-bold text-slate-900">Reading your receipt</p>
              <p className="mt-1 text-sm text-slate-500">Identifying line items…</p>
            </div>
            <div className="dot-pulse flex justify-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary-400" />
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary-400" />
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary-400" />
            </div>
          </div>
        </div>
      )}

      {qualityIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm space-y-4 rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-2xl animate-slide-up">
            <div className="text-5xl">
              {qualityIssue.issue === 'too_dark' ? '🌑' :
               qualityIssue.issue === 'too_bright' ? '☀️' :
               qualityIssue.issue === 'too_blurry' ? '🌫️' : '🔍'}
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">Photo issue</p>
              <p className="mt-1 text-sm text-slate-500">{qualityIssue.message}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => { setQualityIssue(null); fileRef.current?.click() }}
                className="btn-primary"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => setQualityIssue(null)}
                className="py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="page-header flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="icon-btn" aria-label="Back">
          <BackIcon />
        </button>
        <h1 className="flex-1 text-lg font-bold text-slate-900">Add expense</h1>
        {ocrEnabled && (
          <>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleScan} className="hidden" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-xl bg-primary-600 px-3.5 py-2 text-sm font-semibold text-white shadow-md shadow-primary-600/25 active:scale-95"
            >
              <span aria-hidden>📷</span>
              Scan
            </button>
          </>
        )}
      </header>

      <form onSubmit={handleSubmit} className="page-body space-y-4 pb-4 pt-4">
        {!ocrEnabled && (
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">Photo scan</span>
            {' — '}
            add <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">VITE_OPENAI_KEY</code> to{' '}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">.env.local</code> to auto-fill from a photo.
          </div>
        )}

        {aiScanned && (
          <div className="flex items-start gap-3 rounded-2xl border border-primary-200/80 bg-primary-50 px-4 py-3">
            <span className="text-lg text-primary-600">✦</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-primary-900">Items classified</p>
              <p className="mt-0.5 text-xs text-primary-700/90">
                Tap avatars to change who splits each item.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAiScanned(false)}
              className="shrink-0 text-slate-400 hover:text-slate-600"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* Receipt metadata */}
        <div className="card space-y-3 p-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Store</label>
              <input
                className="input-filled"
                placeholder="Target, Trader Joe's…"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Category</label>
              <select
                className="input-filled pr-8"
                value={category}
                onChange={(e) => setCategory(e.target.value as ReceiptCategory)}
              >
                {RECEIPT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Date</label>
              <input type="date" className="input-filled" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Paid by</label>
              <select className="input-filled pr-8" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} required>
                <option value="">Select…</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}{m.id === currentMemberId ? ' (you)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Line items</label>
            <span className="amount text-sm font-bold text-slate-800">{fmt(grandTotal)} total</span>
          </div>

          {items.map((item, i) => (
            <LineItemRow
              key={item.id}
              item={item}
              members={members}
              onChange={(updated) => updateItem(i, updated)}
              onRemove={() => setItems((prev) => prev.filter((_, j) => j !== i))}
            />
          ))}

          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, newItem(allMemberIds)])}
            className="w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white py-3.5 text-sm font-semibold text-primary-600 transition-colors hover:border-primary-300 hover:bg-primary-50/50 active:scale-[0.99]"
          >
            + Add item
          </button>
        </div>

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : `Save · ${fmt(grandTotal)}`}
        </button>
      </form>

      <NavBar joinCode={joinCode ?? ''} />
    </div>
  )
}

function BackIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}
