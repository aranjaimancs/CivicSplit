import { Link, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'

interface Props {
  joinCode: string
}

const NAV_ITEMS = [
  { label: 'Home',    icon: HomeIcon,    to: (c: string) => `/group/${c}` },
  { label: 'Add',     icon: PlusIcon,    to: (c: string) => `/group/${c}/add` },
  { label: 'Settle',  icon: SettleIcon,  to: (c: string) => `/group/${c}/settle` },
  { label: 'History', icon: HistoryIcon, to: (c: string) => `/group/${c}/history` },
]

export function NavBar({ joinCode }: Props) {
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2">
      <div className="border-t border-slate-200/90 bg-white/95 shadow-nav backdrop-blur-md">
        <div
          className="flex items-end justify-stretch px-1 pt-1"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          {NAV_ITEMS.map((item) => {
            const href = item.to(joinCode)
            const isActive = location.pathname === href

            if (item.label === 'Add') {
              return (
                <Link
                  key="Add"
                  to={href}
                  className="relative flex flex-1 flex-col items-center pb-2 pt-2"
                >
                  <span
                    className={clsx(
                      'absolute -top-6 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-fab transition-all duration-200',
                      isActive
                        ? 'scale-105 bg-gradient-to-b from-primary-500 to-primary-700 ring-4 ring-white'
                        : 'bg-gradient-to-b from-primary-500 to-primary-700 hover:brightness-110 active:scale-95'
                    )}
                  >
                    <item.icon className="h-7 w-7" strokeWidth={2.25} />
                  </span>
                  <span
                    className={clsx(
                      'mt-8 text-[11px] font-semibold',
                      isActive ? 'text-primary-600' : 'text-slate-400'
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              )
            }

            return (
              <Link
                key={item.label}
                to={href}
                className={clsx(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors',
                  isActive ? 'text-primary-600' : 'text-slate-400 hover:text-slate-600'
                )}
              >
                <span className="relative">
                  <item.icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.25 : 1.75} />
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary-600" />
                  )}
                </span>
                <span className="text-[11px] font-semibold">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

function HomeIcon({ className, strokeWidth = 1.75 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  )
}

function PlusIcon({ className, strokeWidth = 2.5 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function SettleIcon({ className, strokeWidth = 1.75 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  )
}

function HistoryIcon({ className, strokeWidth = 1.75 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
