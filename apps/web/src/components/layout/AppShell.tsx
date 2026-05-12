import { type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { UserButton, useUser } from '@clerk/clerk-react'
import { FileText, Home, Mic, Settings } from 'lucide-react'

import { cn } from '@/lib/utils'

interface NavEntry {
  to: string
  label: string
  icon: ReactNode
}

const NAV: NavEntry[] = [
  { to: '/', label: 'Dashboard', icon: <Home size={16} /> },
  { to: '/notes', label: 'Notas', icon: <FileText size={16} /> },
  { to: '/audio', label: 'Áudios', icon: <Mic size={16} /> },
  { to: '/settings', label: 'Configurações', icon: <Settings size={16} /> },
]

function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-56 md:flex-col border-r border-zinc-800 bg-zinc-950/50">
      <div className="p-4 border-b border-zinc-800">
        <h1 className="text-lg font-semibold tracking-tight text-emerald-400">Murmur</h1>
        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mt-0.5">
          notas pessoais
        </p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {NAV.map((entry) => (
          <NavLink
            key={entry.to}
            to={entry.to}
            end={entry.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200',
              )
            }
          >
            {entry.icon}
            {entry.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

function Topbar() {
  const { user } = useUser()
  const location = useLocation()

  const titleMap: Record<string, string> = {
    '/': 'Dashboard',
    '/notes': 'Notas',
    '/audio': 'Áudios',
    '/settings': 'Configurações',
  }
  const fallback = location.pathname.split('/').filter(Boolean)[0] ?? ''
  const title = titleMap[location.pathname] ?? fallback.charAt(0).toUpperCase() + fallback.slice(1)

  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-950/60 backdrop-blur sticky top-0 z-10">
      <div className="h-full flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <span className="md:hidden text-emerald-400 font-semibold">Murmur</span>
          <h2 className="text-sm font-medium text-zinc-300">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-zinc-500">
            {user?.primaryEmailAddress?.emailAddress}
          </span>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>
    </header>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
