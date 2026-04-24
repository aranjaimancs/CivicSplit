import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[BudgetSplit] Missing Supabase env vars. Copy .env.example → .env and fill in your project credentials.'
  )
}

// Standard Supabase client — auth is handled automatically via JWT Bearer token.
// RLS policies should use auth.uid() to identify the current user.
export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})
