import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useGroupStore } from '../store'
import { useSessionStore } from '../store'
import type { Receipt, Member, Settlement } from '../types'

/**
 * Subscribe to real-time changes for the current group.
 * Keeps Zustand state fresh so balance calculations never operate on stale data.
 *
 * Covered events:
 *   receipts  INSERT  → add full receipt (with line items) to store
 *   receipts  UPDATE  → re-fetch full receipt (line items may have changed) and update store
 *   receipts  DELETE  → remove from store
 *   members   INSERT  → add new member to store
 *   settlements INSERT → add to store so balances recalculate for all viewers
 *   settlements UPDATE → update in store (e.g. settled_at flipped)
 */
export function useRealtime(groupId: string | undefined) {
  const { addReceipt, updateReceipt, removeReceipt, addSettlement } = useGroupStore()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!groupId) return

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel(`group:${groupId}`)

      // ── receipts: INSERT ──────────────────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'receipts', filter: `group_id=eq.${groupId}` },
        async (payload) => {
          const incoming = payload.new as Receipt
          const { data } = await supabase
            .from('receipts')
            .select(`*, line_items(*, splits:line_item_splits(*))`)
            .eq('id', incoming.id)
            .single()
          if (!data) return

          addReceipt(data as unknown as Receipt)

          const payer = useGroupStore.getState().members.find((m) => m.id === incoming.paid_by)
          const myMemberIds = Object.values(useSessionStore.getState().memberships)
          if (!myMemberIds.includes(incoming.paid_by)) {
            toast(`${payer?.display_name ?? 'Someone'} added a receipt`, {
              icon: '🧾',
              duration: 4000,
            })
          }
        }
      )

      // ── receipts: UPDATE ──────────────────────────────────────────────────────
      // Re-fetch the full row (line items / splits may have changed) so the
      // balance calculation always runs on accurate data.
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'receipts', filter: `group_id=eq.${groupId}` },
        async (payload) => {
          const changed = payload.new as Receipt
          const { data } = await supabase
            .from('receipts')
            .select(`*, line_items(*, splits:line_item_splits(*))`)
            .eq('id', changed.id)
            .single()
          if (data) updateReceipt(data as unknown as Receipt)
        }
      )

      // ── receipts: DELETE ──────────────────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'receipts', filter: `group_id=eq.${groupId}` },
        (payload) => {
          const deleted = payload.old as { id: string }
          if (deleted?.id) removeReceipt(deleted.id)
        }
      )

      // ── members: INSERT ───────────────────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'members', filter: `group_id=eq.${groupId}` },
        (payload) => {
          const newMember = payload.new as Member
          const alreadyExists = useGroupStore.getState().members.find((m) => m.id === newMember.id)
          if (!alreadyExists) {
            useGroupStore.setState((s) => ({ members: [...s.members, newMember] }))
            const myMemberIds = Object.values(useSessionStore.getState().memberships)
            if (!myMemberIds.includes(newMember.id)) {
              toast(`${newMember.display_name} joined the group`, { icon: '👋', duration: 3000 })
            }
          }
        }
      )

      // ── settlements: INSERT ───────────────────────────────────────────────────
      // Another user marked a payment as settled — update balances immediately.
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'settlements', filter: `group_id=eq.${groupId}` },
        (payload) => {
          const s = payload.new as Settlement
          // Deduplicate: we may have already added this from handleMarkPaid
          const exists = useGroupStore.getState().settlements.find((x) => x.id === s.id)
          if (!exists) {
            addSettlement(s)
            const from = useGroupStore.getState().members.find((m) => m.id === s.from_member)
            const to   = useGroupStore.getState().members.find((m) => m.id === s.to_member)
            const myMemberIds = Object.values(useSessionStore.getState().memberships)
            if (from && to && !myMemberIds.includes(s.from_member)) {
              toast(`${from.display_name} paid ${to.display_name}`, { icon: '✓', duration: 3500 })
            }
          }
        }
      )

      // ── settlements: UPDATE ───────────────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'settlements', filter: `group_id=eq.${groupId}` },
        (payload) => {
          const updated = payload.new as Settlement
          useGroupStore.setState((s) => ({
            settlements: s.settlements.map((x) => (x.id === updated.id ? updated : x)),
          }))
        }
      )

      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [groupId]) // eslint-disable-line react-hooks/exhaustive-deps
}
