import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useSessionStore } from '../store'

const siteUrl = () =>
  (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') || window.location.origin

async function loadMembershipsMap(userId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('members')
    .select('id, groups!inner(join_code)')
    .eq('user_id', userId)

  if (error || !data?.length) return {}

  const map: Record<string, string> = {}
  for (const row of data as unknown as { id: string; groups: { join_code: string } | { join_code: string }[] }[]) {
    const g = Array.isArray(row.groups) ? row.groups[0] : row.groups
    if (g?.join_code) map[g.join_code.toUpperCase()] = row.id
  }
  return map
}

type AuthContextValue = {
  session: Session | null
  user: User | null
  loading: boolean
  signInWithEmail: (email: string) => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshMemberships: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const hydrateMemberships = useSessionStore((s) => s.hydrateMemberships)

  const refreshMemberships = useCallback(async () => {
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) {
      hydrateMemberships({})
      return
    }
    const map = await loadMembershipsMap(u.id)
    hydrateMemberships(map)
  }, [hydrateMemberships])

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (cancelled) return
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
      if (s?.user) {
        void loadMembershipsMap(s.user.id).then((map) => {
          if (!cancelled) hydrateMemberships(map)
        })
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setUser(next?.user ?? null)
      if (next?.user) {
        void loadMembershipsMap(next.user.id).then((map) => {
          if (!cancelled) hydrateMemberships(map)
        })
      } else {
        hydrateMemberships({})
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [hydrateMemberships])

  const signInWithEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${siteUrl()}/` },
    })
    return { error: error ? new Error(error.message) : null }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${siteUrl()}/` },
    })
    return { error: error ? new Error(error.message) : null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    hydrateMemberships({})
  }, [hydrateMemberships])

  const value = useMemo(
    () => ({
      session,
      user,
      loading,
      signInWithEmail,
      signInWithGoogle,
      signOut,
      refreshMemberships,
    }),
    [session, user, loading, signInWithEmail, signInWithGoogle, signOut, refreshMemberships]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
