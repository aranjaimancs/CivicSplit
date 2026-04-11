import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useGroupStore } from '../store'
import { useSessionStore } from '../store'
import type { Receipt, Member } from '../types'

/**
 * Subscribe to real-time changes for the current group.
 * Shows toast notifications when other members add receipts.
 */
export function useRealtime(groupId: string | undefined) {
  const { addReceipt } = useGroupStore()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!groupId) return

    // Clean up any existing subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel(`group:${groupId}`)
      // New receipts
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'receipts', filter: `group_id=eq.${groupId}` },
        async (payload) => {
          const newReceipt = payload.new as Receipt

          // Fetch full receipt with line items
          const { data } = await supabase
            .from('receipts')
            .select(`*, line_items(*, splits:line_item_splits(*))`)
            .eq('id', newReceipt.id)
            .single()

          if (!data) return
          addReceipt(data as unknown as Receipt)

          // Toast only if added by someone else
          const payer = useGroupStore.getState().members.find(
            (m) => m.id === newReceipt.paid_by
          )
          // Check if this receipt was added by the current user's member
          const myMemberId = Object.values(useSessionStore.getState().memberships)
          const isMe = myMemberId.includes(newReceipt.paid_by)
          if (!isMe) {
            const name = payer?.display_name ?? 'Someone'
            toast(`${name} added a receipt`, {
              icon: '🧾',
              duration: 4000,
            })
          }
        }
      )
      // New members joining
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'members', filter: `group_id=eq.${groupId}` },
        (payload) => {
          const newMember = payload.new as Member
          const alreadyExists = useGroupStore.getState().members.find(
            (m) => m.id === newMember.id
          )
          if (!alreadyExists) {
            useGroupStore.setState((s) => ({ members: [...s.members, newMember] }))
            const myMemberId = Object.values(useSessionStore.getState().memberships)
            if (!myMemberId.includes(newMember.id)) {
              toast(`${newMember.display_name} joined the group`, {
                icon: '👋',
                duration: 3000,
              })
            }
          }
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
