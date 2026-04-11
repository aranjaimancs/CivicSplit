import { clsx } from 'clsx'
import type { Member } from '../types'

const AVATAR_COLORS = [
  '#4F46BB',
  '#E85D75',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
]

export function avatarColor(memberId: string): string {
  let hash = 0
  for (let i = 0; i < memberId.length; i++) {
    hash = (hash + memberId.charCodeAt(i)) % AVATAR_COLORS.length
  }
  return AVATAR_COLORS[hash]
}

interface Props {
  member: Member
  size?: 'xs' | 'sm' | 'md' | 'lg'
  ring?: boolean
  className?: string
}

export function MemberAvatar({ member, size = 'md', ring = false, className }: Props) {
  const color = member.avatar_color || avatarColor(member.id)
  const initials = member.display_name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div
      className={clsx(
        'flex items-center justify-center rounded-full font-semibold text-white flex-shrink-0 select-none',
        ring && 'ring-2 ring-white ring-offset-1',
        size === 'xs' && 'w-6 h-6 text-[9px]',
        size === 'sm' && 'w-8 h-8 text-xs',
        size === 'md' && 'w-10 h-10 text-sm',
        size === 'lg' && 'w-14 h-14 text-base font-bold',
        className
      )}
      style={{ backgroundColor: color }}
      title={member.display_name}
    >
      {initials}
    </div>
  )
}
