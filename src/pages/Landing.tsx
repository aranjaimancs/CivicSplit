import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useSessionStore } from '../store'
import { avatarColor } from '../components/MemberAvatar'

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

type Mode = 'home' | 'create' | 'join'

export function Landing() {
  const navigate = useNavigate()
  const { userId, setMembership } = useSessionStore()
  const [mode, setMode] = useState<Mode>('home')
  const [loading, setLoading] = useState(false)

  const [groupName, setGroupName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joinName, setJoinName] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!groupName.trim() || !displayName.trim()) return
    setLoading(true)
    try {
      let code = generateJoinCode()
      for (let i = 0; i < 5; i++) {
        const { data: existing } = await supabase.from('groups').select('id').eq('join_code', code).maybeSingle()
        if (!existing) break
        code = generateJoinCode()
      }

      const { data: newGroup, error: gErr } = await supabase
        .from('groups').insert({ name: groupName.trim(), join_code: code }).select().single()
      if (gErr) throw gErr

      const { data: member, error: mErr } = await supabase
        .from('members').insert({
          group_id: newGroup.id,
          user_id: userId,
          display_name: displayName.trim(),
          avatar_color: avatarColor(userId),
        }).select().single()
      if (mErr) throw mErr

      setMembership(code, member.id)
      toast.success(`Group created! Code: ${code}`)
      navigate(`/group/${code}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create group')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (!code || !joinName.trim()) return
    setLoading(true)
    try {
      const { data: group, error: gErr } = await supabase
        .from('groups').select('*').eq('join_code', code).single()
      if (gErr || !group) throw new Error('Group not found. Check the code.')

      const { data: existing } = await supabase
        .from('members').select('*').eq('group_id', group.id).eq('user_id', userId).maybeSingle()
      if (existing) {
        setMembership(code, existing.id)
        navigate(`/group/${code}`)
        return
      }

      const { data: member, error: mErr } = await supabase
        .from('members').insert({
          group_id: group.id,
          user_id: userId,
          display_name: joinName.trim(),
          avatar_color: avatarColor(userId),
        }).select().single()
      if (mErr) throw mErr

      setMembership(code, member.id)
      toast.success(`Joined ${group.name}!`)
      navigate(`/group/${code}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to join group')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden"
      style={{ background: 'linear-gradient(165deg, #312E81 0%, #4F46BB 45%, #6366F1 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-white/[0.07] blur-3xl" />
        <div className="absolute left-1/4 top-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="absolute -bottom-8 right-10 h-48 w-48 rounded-full bg-white/[0.05] blur-2xl" />
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-8 pt-20">
        <div className="mb-12 animate-fade-in text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 text-4xl shadow-lg shadow-black/10 ring-1 ring-white/20 backdrop-blur-sm">
            🏛️
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white">CivicSplit</h1>
          <p className="mx-auto mt-3 max-w-[280px] text-sm leading-relaxed text-white/70">
            Expense splitting for Morehead-Cain Civic Collaboration groups
          </p>
        </div>

        <div className="w-full max-w-sm animate-slide-up">
          {mode === 'home' && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setMode('create')}
                className="w-full rounded-2xl bg-white py-4 text-[15px] font-semibold text-primary-700 shadow-lg shadow-black/10 transition-all hover:bg-slate-50 active:scale-[0.99]"
              >
                Create a group
              </button>
              <button
                type="button"
                onClick={() => setMode('join')}
                className="btn-ghost w-full py-4"
              >
                Join with a code
              </button>
            </div>
          )}

          {mode === 'create' && (
            <form onSubmit={handleCreate} className="space-y-4 rounded-3xl border border-white/10 bg-white/95 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl animate-slide-up">
              <div className="mb-1 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMode('home')}
                  className="icon-btn border-slate-200 bg-slate-50 text-slate-600"
                  aria-label="Back"
                >
                  <BackIcon />
                </button>
                <h2 className="text-lg font-bold text-slate-900">New group</h2>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Group name</label>
                <input
                  className="input-filled"
                  placeholder="e.g. Greenwood House"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  required maxLength={60} autoFocus
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Your name</label>
                <input
                  className="input-filled"
                  placeholder="e.g. Alex"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required maxLength={40}
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary mt-1">
                {loading ? 'Creating…' : 'Create group'}
              </button>
            </form>
          )}

          {mode === 'join' && (
            <form onSubmit={handleJoin} className="space-y-4 rounded-3xl border border-white/10 bg-white/95 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl animate-slide-up">
              <div className="mb-1 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMode('home')}
                  className="icon-btn border-slate-200 bg-slate-50 text-slate-600"
                  aria-label="Back"
                >
                  <BackIcon />
                </button>
                <h2 className="text-lg font-bold text-slate-900">Join a group</h2>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Join code</label>
                <input
                  className="input-filled text-center font-mono text-lg uppercase tracking-[0.35em]"
                  placeholder="••••••"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  required maxLength={6} autoCapitalize="characters" autoFocus
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Your name</label>
                <input
                  className="input-filled"
                  placeholder="e.g. Jordan"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  required maxLength={40}
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary mt-1">
                {loading ? 'Joining…' : 'Join group'}
              </button>
            </form>
          )}
        </div>
      </div>

      <p className="relative pb-8 text-center text-xs text-white/35">Morehead-Cain Foundation · 2026</p>
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
