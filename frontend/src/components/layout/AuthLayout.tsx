import { Link, Outlet } from 'react-router-dom'
import { Logo } from '@/components/Logo'

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-8"><Logo /></div>
      <main id="main" tabIndex={-1} className="w-full max-w-md rounded-xl border bg-surface/80 p-6 shadow-2xl backdrop-blur sm:p-8"><Outlet /></main>
      <p className="mt-6 text-xs text-muted"><Link to="/privacy" className="underline underline-offset-4">Privacy</Link> · <Link to="/docs" className="underline underline-offset-4">Documentation</Link></p>
    </div>
  )
}
