import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useIsAdmin(user: User | null): { isAdmin: boolean; loading: boolean } {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setIsAdmin(false)
      return
    }
    setLoading(true)
    supabase
      .from('admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setIsAdmin(!!data)
        setLoading(false)
      })
  }, [user?.id])

  return { isAdmin, loading }
}
