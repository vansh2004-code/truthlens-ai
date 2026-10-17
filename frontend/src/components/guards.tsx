import { Loader2, ShieldAlert } from 'lucide-react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

export function FullPageSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-[50vh] items-center justify-center gap-3 text-muted">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden /><span>{label}…</span>
    </div>
  )
}

export function RequireAuth() {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <FullPageSpinner label="Checking your session" />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  return <Outlet />
}

export function RequireAdmin() {
  const { user } = useAuth()
  if (user?.role !== 'admin') {
    return (
      <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
        <ShieldAlert className="h-8 w-8 text-warn" aria-hidden />
        <h1 className="text-2xl font-semibold">Administrator access required</h1>
        <p className="text-sm text-muted">Your account does not have permission to view this page.</p>
        <Link to="/dashboard" className="text-sm text-primary underline underline-offset-4">Back to dashboard</Link>
      </div>
    )
  }
  return <Outlet />
}
