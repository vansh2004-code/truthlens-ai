import { useMutation } from '@tanstack/react-query'
import { History, LayoutDashboard, ListChecks, LogOut, Settings, ShieldCheck, Upload, BookOpen } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { VerifyBanner } from '@/components/VerifyBanner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/analyze', label: 'Analyze', icon: Upload },
  { to: '/queue', label: 'Queue', icon: ListChecks },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const linkCls = ({ isActive }: { isActive: boolean }) =>
  cn('flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors', isActive ? 'bg-elevated text-fg' : 'text-muted hover:bg-elevated/60 hover:text-fg')

export function AppShell() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const out = useMutation({ mutationFn: logout, onSettled: () => nav('/login', { replace: true }) })
  const items = user?.role === 'admin' ? [...NAV, { to: '/admin', label: 'Admin', icon: ShieldCheck }] : NAV

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r bg-surface/60 p-4 backdrop-blur md:flex">
        <div className="mb-6 px-2 pt-1"><Logo to="/dashboard" /></div>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} className={linkCls}><n.icon className="h-4 w-4" aria-hidden />{n.label}</NavLink>
          ))}
          <div className="mt-4 border-t pt-4">
            <NavLink to="/docs" className={linkCls}><BookOpen className="h-4 w-4" aria-hidden />Documentation</NavLink>
            <NavLink to="/privacy" className={linkCls}><ShieldCheck className="h-4 w-4" aria-hidden />Privacy</NavLink>
          </div>
        </nav>
        <div className="rounded-lg border bg-bg/50 p-3">
          <p className="truncate text-sm font-medium">{user?.display_name}</p>
          <p className="truncate text-xs text-muted">{user?.email}</p>
          <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" onClick={() => out.mutate()} loading={out.isPending}><LogOut className="h-4 w-4" aria-hidden />Sign out</Button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-bg/80 px-4 py-3 backdrop-blur md:hidden">
          <Logo to="/dashboard" />
          <Button variant="ghost" size="sm" onClick={() => out.mutate()} loading={out.isPending} aria-label="Sign out"><LogOut className="h-4 w-4" aria-hidden /></Button>
        </header>
        <VerifyBanner />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:pb-12 md:pt-10">
          <Outlet />
        </main>
        <nav aria-label="Main (mobile)" className="fixed inset-x-0 bottom-0 z-40 grid border-t bg-surface/95 backdrop-blur md:hidden" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-primary' : 'text-muted')}>
              <n.icon className="h-5 w-5" aria-hidden />{n.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

