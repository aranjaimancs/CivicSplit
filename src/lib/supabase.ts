import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[CivicSplit] Missing Supabase env vars. Copy .env.example → .env and fill in your project credentials.'
  )
}

/**
 * Read the anonymous user ID that Zustand persists to localStorage.
 * Structure: { state: { userId: '<uuid>', memberships: {...} } }
 */
function getStoredUserId(): string {
  try {
    const raw = localStorage.getItem('civicsplit-session')
    if (!raw) return ''
    const parsed = JSON.parse(raw) as { state?: { userId?: string } }
    return parsed?.state?.userId ?? ''
  } catch {
    return ''
  }
}

/**
 * Read the admin passcode that AdminDashboard writes to localStorage on login.
 * Value is the raw passcode string (e.g. 'civic2026').
 */
function getStoredAdminPasscode(): string {
  return localStorage.getItem('civicsplit_admin') ?? ''
}

/**
 * Supabase client with per-request header injection.
 *
 * We override the global `fetch` so that every PostgREST request automatically
 * carries two optional headers:
 *
 *   x-user-id        — the user's anonymous UUID, read from localStorage.
 *                      RLS policies use this to enforce group membership.
 *
 *   x-admin-passcode — the admin passcode when an admin is signed in.
 *                      RLS policies use this to allow cross-group queries.
 *
 * Reading from localStorage at fetch-time (not at client-creation time) means
 * the headers stay current even if the user joins a group mid-session.
 */
export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    fetch: (input: RequestInfo | URL, init: RequestInit = {}) => {
      const headers = new Headers(init.headers)

      const userId = getStoredUserId()
      if (userId) headers.set('x-user-id', userId)

      const adminPasscode = getStoredAdminPasscode()
      if (adminPasscode) headers.set('x-admin-passcode', adminPasscode)

      return fetch(input, { ...init, headers })
    },
  },
})
