import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'

export function PublicHeader() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const links = [{ to: '/docs', label: 'Documentation' }, { to: '/privacy', label: 'Privacy' }]
  return (
    <header className="sticky top-0 z-30 border-b bg-bg/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {links.map((l) => <NavLink key={l.to} to={l.to} className="text-sm text-muted hover:text-fg">{l.label}</NavLink>)}
          {user ? (
            <Button asChild variant="primary" size="sm"><Link to="/dashboard">Open dashboard</Link></Button>
          ) : (
            <>
              <Link to="/login" className="text-sm text-muted hover:text-fg">Sign in</Link>
              <Button asChild variant="primary" size="sm"><Link to="/register">Create account</Link></Button>
            </>
          )}
        </nav>
        <button className="rounded-md p-2 text-muted hover:bg-elevated md:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <nav aria-label="Primary (mobile)" className="container flex flex-col gap-1 pb-4 md:hidden">
          {links.map((l) => <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-elevated">{l.label}</Link>)}
          {user ? <Link to="/dashboard" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-elevated">Open dashboard</Link> : (
            <>
              <Link to="/login" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-elevated">Sign in</Link>
              <Link to="/register" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-elevated">Create account</Link>
            </>
          )}
        </nav>
      )}
    </header>
  )
}

export function Footer() {
  return (
    <footer className="mt-24 border-t">
      <div className="container flex flex-col gap-6 py-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-3">
          <Logo />
          <p className="text-sm text-muted">Media forensics support tooling. Results are uncalibrated model outputs intended to assist human review, not to replace it.</p>
        </div>
        <nav aria-label="Footer" className="flex gap-10 text-sm">
          <div className="flex flex-col gap-2"><span className="font-medium">Product</span><Link className="text-muted hover:text-fg" to="/docs">Documentation</Link><Link className="text-muted hover:text-fg" to="/privacy">Privacy</Link></div>
          <div className="flex flex-col gap-2"><span className="font-medium">Account</span><Link className="text-muted hover:text-fg" to="/login">Sign in</Link><Link className="text-muted hover:text-fg" to="/register">Create account</Link></div>
        </nav>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted">TruthLens AI. Scores are not probabilities and are not proof.</div>
    </footer>
  )
}

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main id="main" tabIndex={-1} className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  )
}
