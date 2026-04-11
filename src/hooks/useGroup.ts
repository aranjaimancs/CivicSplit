import { useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useGroupStore } from '../store'
import type { Group, Member, Receipt } from '../types'

/**
 * Loads group data (group row, members, receipts with line items)
 * for a given join code. Populates the group store.
 */
export function useGroup(joinCode: string | undefined) {
  const { setGroup, setMembers, setReceipts, setLoading, setError, reset } = useGroupStore()

  const load = useCallback(async () => {
    if (!joinCode) return
    setLoading(true)
    setError(null)

    try {
      // 1. Fetch group
      const { data: groupData, error: groupErr } = await supabase
        .from('groups')
        .select('*')
        .eq('join_code', joinCode.toUpperCase())
        .single()

      if (groupErr || !groupData) {
        setError('Group not found. Check the join code and try again.')
        setLoading(false)
        return
      }
      setGroup(groupData as Group)

      // 2. Fetch members
      const { data: membersData, error: membersErr } = await supabase
        .from('members')
        .select('*')
        .eq('group_id', groupData.id)
        .order('created_at', { ascending: true })

      if (membersErr) throw membersErr
      setMembers((membersData ?? []) as Member[])

      // 3. Fetch receipts with line items and splits
      await loadReceipts(groupData.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load group')
    } finally {
      setLoading(false)
    }
  }, [joinCode]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadReceipts = async (groupId: string) => {
    const { data, error } = await supabase
      .from('receipts')
      .select(`
        *,
        line_items (
          *,
          splits:line_item_splits (*)
        )
      `)
      .eq('group_id', groupId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    setReceipts((data ?? []) as unknown as Receipt[])
  }

  useEffect(() => {
    reset()
    load()
  }, [joinCode]) // eslint-disable-line react-hooks/exhaustive-deps

  return { reload: load }
}
