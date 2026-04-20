import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useSessionStore } from '../store'
import { avatarColor } from '../components/MemberAvatar'

export function Landing() {
  const navigate = useNavigate()
  const { userId, setMembership } = useSessionStore()
  const [cohortCode, setCohortCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const code = cohortCode.trim().toUpperCase()
    if (!code || !displayName.trim()) return
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
        .eq('user_id', userId)
        .maybeSingle()
      if (existing) {
        // Update name if the user entered a different one (e.g. fixing a typo)
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
          user_id: userId,
          display_name: displayName.trim(),
          avatar_color: avatarColor(userId),
        })
        .select()
        .single()
      if (mErr) throw mErr

      setMembership(code, member.id)
      toast.success(`Welcome to ${group.name}!`)
      navigate(`/group/${code}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join cohort')
    } finally {
      setLoading(false)
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
          <h1 className="text-[2.6rem] font-bold leading-none tracking-tight text-white">
            CivicSplit
          </h1>
          <p className="mx-auto mt-3 max-w-[260px] text-[13px] leading-relaxed text-white/60">
            Enter your cohort code to access your group's expense tracker
          </p>
        </div>

        {/* Form */}
        <div className="w-full max-w-sm animate-slide-up">
          <form
            onSubmit={handleJoin}
            className="space-y-5 rounded-3xl bg-white p-7 shadow-[0_24px_64px_rgba(15,23,42,0.22)] ring-1 ring-black/5"
          >
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
                autoFocus
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

      {/* Footer */}
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
