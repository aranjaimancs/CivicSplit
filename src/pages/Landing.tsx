import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useSessionStore } from '../store'
import { useAuth } from '../contexts/AuthContext'
import { avatarColor } from '../components/MemberAvatar'

// ─── Root ──────────────────────────────────────────────────────────────────────

export function Landing() {
  const { user, loading: authLoading, signOut } = useAuth()

  if (authLoading) return <LoadingScreen />
  if (!user) return <SignInScreen />
  return <JoinScreen onSignOut={signOut} />
}

// ─── Loading ───────────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: 'linear-gradient(165deg, #312E81 0%, #4F46BB 45%, #6366F1 100%)' }}>
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
    </div>
  )
}

// ─── Sign-in ───────────────────────────────────────────────────────────────────

function SignInScreen() {
  const { signInWithGoogle, signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleGoogle() {
    setLoading(true)
    const { error } = await signInWithGoogle()
    if (error) {
      toast.error(error.message)
      setLoading(false)
    }
    // on success Supabase redirects away; loading state stays
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    const { error } = await signInWithEmail(email)
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      setEmailSent(true)
    }
  }

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden"
      style={{ background: 'linear-gradient(165deg, #312E81 0%, #4F46BB 45%, #6366F1 100%)' }}
    >
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-white/[0.07] blur-3xl" />
        <div className="absolute left-1/4 top-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="absolute -bottom-8 right-10 h-48 w-48 rounded-full bg-white/[0.05] blur-2xl" />
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-8 pt-16">
        {/* Hero */}
        <div className="mb-10 animate-fade-in text-center">
          <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 rounded-[1.75rem] bg-white/10 shadow-2xl shadow-black/20 ring-1 ring-white/20 backdrop-blur-sm" />
            <div className="absolute inset-[3px] rounded-[1.4rem] bg-gradient-to-br from-white/15 to-transparent" />
            <span className="relative text-5xl">🏛️</span>
          </div>
          <h1 className="text-[2.6rem] font-bold leading-none tracking-tight text-white">CivicSplit</h1>
          <p className="mx-auto mt-3 max-w-[260px] text-[13px] leading-relaxed text-white/60">
            Sign in to access your cohort's expense tracker
          </p>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm animate-slide-up">
          <div className="space-y-5 rounded-3xl bg-white p-7 shadow-[0_24px_64px_rgba(15,23,42,0.22)] ring-1 ring-black/5">
            {emailSent ? (
              <div className="py-4 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
                  ✉️
                </div>
                <p className="font-bold text-slate-900">Check your inbox</p>
                <p className="mt-1.5 text-sm text-slate-500">
                  We sent a sign-in link to <span className="font-semibold">{email}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setEmailSent(false)}
                  className="mt-4 text-xs font-semibold text-primary-600 underline underline-offset-2"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <>
                {/* Google button */}
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-100" />
                  <span className="text-xs font-semibold text-slate-400">or</span>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>

                {/* Email magic link */}
                <form onSubmit={handleEmail} className="space-y-3">
                  <input
                    type="email"
                    className="input-filled py-3.5"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <button type="submit" disabled={loading} className="btn-primary">
                    {loading ? 'Sending…' : 'Send magic link'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      <p className="relative pb-8 text-center text-xs text-white/25">
        Morehead-Cain Foundation · 2026 ·{' '}
        <Link
          to="/admin"
          className="underline decoration-white/20 underline-offset-2 transition-colors hover:text-white/50"
        >
          Admin
        </Link>
      </p>
    </div>
  )
}

// ─── Join cohort ───────────────────────────────────────────────────────────────

function JoinScreen({ onSignOut }: { onSignOut: () => void }) {
  const navigate = useNavigate()
  const { user, refreshMemberships } = useAuth()
  const { memberships, setMembership } = useSessionStore()
  const [cohortCode, setCohortCode] = useState('')
  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.full_name?.split(' ')[0] ?? ''
  )
  const [loading, setLoading] = useState(false)
  const [groupNames, setGroupNames] = useState<Record<string, string>>({})

  const existingGroups = Object.keys(memberships)

  useEffect(() => {
    if (existingGroups.length === 0) return
    supabase
      .from('groups')
      .select('join_code, name')
      .in('join_code', existingGroups)
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, string> = {}
        for (const g of data) map[g.join_code] = g.name
        setGroupNames(map)
      })
  }, [existingGroups.join(',')])

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const code = cohortCode.trim().toUpperCase()
    if (!code || !displayName.trim() || !user) return
    setLoading(true)
    try {
      const { data: group, error: gErr } = await supabase
        .from('groups')
        .select('*')
        .eq('join_code', code)
        .single()
      if (gErr || !group) throw new Error('Cohort not found. Double-check your code.')

      const { data: existing } = await supabase
        .from('members')
        .select('*')
        .eq('group_id', group.id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (existing) {
        if (existing.display_name !== displayName.trim() && displayName.trim()) {
          await supabase
            .from('members')
            .update({ display_name: displayName.trim() })
            .eq('id', existing.id)
        }
        setMembership(code, existing.id)
        navigate(`/group/${code}`)
        return
      }

      const { data: member, error: mErr } = await supabase
        .from('members')
        .insert({
          group_id: group.id,
          user_id: user.id,
          display_name: displayName.trim(),
          avatar_color: avatarColor(user.id),
        })
        .select()
        .single()
      if (mErr) throw mErr

      await refreshMemberships()
      setMembership(code, member.id)
      toast.success(`Welcome to ${group.name}!`)
      navigate(`/group/${code}`)
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : JSON.stringify(err)
      toast.error(msg)
      console.error('[Join cohort error]', err)
    } finally {
      setLoading(false)
    }
  }

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden"
      style={{ background: 'linear-gradient(165deg, #312E81 0%, #4F46BB 45%, #6366F1 100%)' }}
    >
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-white/[0.07] blur-3xl" />
        <div className="absolute left-1/4 top-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="absolute -bottom-8 right-10 h-48 w-48 rounded-full bg-white/[0.05] blur-2xl" />
      </div>

      {/* Signed-in user pill */}
      <div className="relative flex items-center justify-between px-5 pt-safe pt-5">
        <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/20">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-6 w-6 rounded-full" />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
              {(user?.email ?? 'U')[0].toUpperCase()}
            </div>
          )}
          <span className="max-w-[180px] truncate text-xs font-semibold text-white/80">
            {user?.user_metadata?.full_name ?? user?.email}
          </span>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/60 ring-1 ring-white/20 transition-colors hover:bg-white/20 hover:text-white"
        >
          Sign out
        </button>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-8 pt-8">
        {/* Hero */}
        <div className="mb-8 animate-fade-in text-center">
          <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 rounded-[1.5rem] bg-white/10 shadow-2xl shadow-black/20 ring-1 ring-white/20 backdrop-blur-sm" />
            <span className="relative text-4xl">🏛️</span>
          </div>
          <h1 className="text-[2.2rem] font-bold leading-none tracking-tight text-white">CivicSplit</h1>
        </div>

        <div className="w-full max-w-sm animate-slide-up space-y-4">
          {/* Existing groups */}
          {existingGroups.length > 0 && (
            <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
              <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
                My cohorts
              </p>
              <div className="space-y-2">
                {existingGroups.map((code) => {
                  const name = groupNames[code]
                  const label = name ? `${name} (${code})` : code
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => navigate(`/group/${code}`)}
                      className="flex w-full items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-left transition-colors hover:bg-white/20"
                    >
                      <span className="text-sm font-bold text-white">{label}</span>
                      <span className="text-xs text-white/50">Open →</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Join form */}
          <form
            onSubmit={handleJoin}
            className="space-y-5 rounded-3xl bg-white p-7 shadow-[0_24px_64px_rgba(15,23,42,0.22)] ring-1 ring-black/5"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {existingGroups.length > 0 ? 'Join another cohort' : 'Join your cohort'}
            </p>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                Cohort code
              </label>
              <input
                className="input-filled py-3.5 text-center font-mono text-xl uppercase tracking-[0.4em]"
                placeholder="······"
                value={cohortCode}
                onChange={(e) => setCohortCode(e.target.value.toUpperCase())}
                required
                maxLength={6}
                autoCapitalize="characters"
                autoFocus={existingGroups.length === 0}
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                Your name
              </label>
              <input
                className="input-filled py-3.5"
                placeholder="e.g. Jordan"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={40}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Joining…' : 'Join cohort'}
            </button>
          </form>
        </div>
      </div>

      <p className="relative pb-8 text-center text-xs text-white/25">
        Morehead-Cain Foundation · 2026 ·{' '}
        <Link
          to="/admin"
          className="underline decoration-white/20 underline-offset-2 transition-colors hover:text-white/50"
        >
          Admin
        </Link>
      </p>
    </div>
  )
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  )
}
