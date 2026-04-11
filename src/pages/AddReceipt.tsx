import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useGroupStore } from '../store'
import { useSessionStore } from '../store'
import { LineItemRow } from '../components/LineItemRow'
import { NavBar } from '../components/NavBar'
import { isOcrEnabled, parseReceiptImage } from '../lib/ocr'
import { round2, fmt } from '../lib/calculations'
import type { DraftLineItem } from '../types'

function newItem(): DraftLineItem {
  return { id: crypto.randomUUID(), name: '', price: '', split_type: 'shared', custom_splits: {} }
}

export function AddReceipt() {
  const { joinCode } = useParams<{ joinCode: string }>()
  const navigate = useNavigate()
  const { group, members } = useGroupStore()
  const { getMemberId } = useSessionStore()
  const currentMemberId = getMemberId(joinCode ?? '')

  const [storeName, setStoreName] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [paidBy, setPaidBy] = useState(currentMemberId ?? '')
  const [items, setItems] = useState<DraftLineItem[]>([newItem()])
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [aiScanned, setAiScanned] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const sharedTotal = items
    .filter((i) => i.split_type === 'shared')
    .reduce((s, i) => s + (parseFloat(i.price) || 0), 0)
  const shareEach = members.length > 0 ? sharedTotal / members.length : 0
  const grandTotal = items.reduce((s, i) => {
    if (i.split_type === 'custom')
      return s + Object.values(i.custom_splits).reduce((a, v) => a + (parseFloat(v) || 0), 0)
    return s + (parseFloat(i.price) || 0)
  }, 0)

  function updateItem(index: number, updated: DraftLineItem) {
    setItems((prev) => prev.map((item, i) => (i === index ? updated : item)))
  }

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
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
          split_type: item.split_type,
          custom_splits: {},
          aiReason: item.aiReason,
          aiSuggested: item.split_type,
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

    const validItems = items.filter((i) => i.name.trim() && parseFloat(i.price) > 0)
    if (validItems.length === 0) {
      toast.error('Add at least one item with a name and price')
      return
    }

    setSaving(true)
    try {
      const total = round2(
        validItems.reduce((s, i) => {
          if (i.split_type === 'custom')
            return s + Object.values(i.custom_splits).reduce((a, v) => a + (parseFloat(v) || 0), 0)
          return s + (parseFloat(i.price) || 0)
        }, 0)
      )

      const { data: receipt, error: rErr } = await supabase
        .from('receipts')
        .insert({ group_id: group.id, paid_by: paidBy, store_name: storeName.trim() || 'Store', date, total })
        .select().single()
      if (rErr) throw rErr

      const { data: lineItems, error: liErr } = await supabase
        .from('line_items')
        .insert(validItems.map((i) => ({ receipt_id: receipt.id, name: i.name.trim(), price: parseFloat(i.price), split_type: i.split_type })))
        .select()
      if (liErr) throw liErr

      const splitInserts = validItems.flatMap((item, idx) => {
        if (item.split_type !== 'custom') return []
        const li = lineItems[idx]
        if (!li) return []
        return Object.entries(item.custom_splits)
          .filter(([, amt]) => parseFloat(amt) > 0)
          .map(([memberId, amt]) => ({ line_item_id: li.id, member_id: memberId, amount: parseFloat(amt) }))
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
    <div className="min-h-screen bg-app-bg pb-36">
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

      <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4 pt-4">
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
              <p className="mt-0.5 text-xs text-primary-700/90">Tap a badge to switch shared ↔ personal.</p>
            </div>
            <button type="button" onClick={() => setAiScanned(false)} className="shrink-0 text-slate-400 hover:text-slate-600" aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        <div className="card space-y-3 p-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Store</label>
            <input
              className="input-filled"
              placeholder="Target, Trader Joe's…"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              maxLength={80}
            />
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

        {sharedTotal > 0 && (
          <div className="flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Shared total</p>
              <p className="amount text-lg font-bold text-slate-900">{fmt(sharedTotal)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Per person</p>
              <p className="amount text-lg font-bold text-slate-900">{fmt(shareEach)}</p>
            </div>
          </div>
        )}

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
              memberCount={members.length}
              onChange={(updated) => updateItem(i, updated)}
              onRemove={() => setItems((prev) => prev.filter((_, j) => j !== i))}
            />
          ))}

          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, newItem()])}
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
