import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { api, errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'

export default function VerifyEmail() {
  const [sp] = useSearchParams()
  const token = sp.get('token') ?? ''
  const qc = useQueryClient()
  const { user } = useAuth()
  const q = useQuery({
    queryKey: ['verify-email', token],
    enabled: token.length > 0,
    retry: false,
    staleTime: Infinity,
    queryFn: async () => {
      await api('/api/auth/verify-email', { method: 'POST', json: { token }, noRefresh: true })
      void qc.invalidateQueries({ queryKey: ['me'] })
      return true
    },
  })
  const dest = user ? '/dashboard' : '/login'
  if (!token || q.isError) {
    return (
      <div role="alert" className="space-y-3 text-center">
        <XCircle className="mx-auto h-8 w-8 text-danger" aria-hidden />
        <h1 className="text-2xl font-semibold">Could not verify your email</h1>
        <p className="text-sm text-muted">{token ? errorMessage(q.error) : 'The verification link is missing its token.'} Sign in and use "Resend email" to get a fresh link.</p>
        <Button asChild variant="secondary"><Link to={dest}>{user ? 'Go to dashboard' : 'Sign in'}</Link></Button>
      </div>
    )
  }
  if (q.isSuccess) {
    return (
      <div role="status" className="space-y-3 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-ok" aria-hidden />
        <h1 className="text-2xl font-semibold">Email verified</h1>
        <p className="text-sm text-muted">Thank you. Your email address is now confirmed.</p>
        <Button asChild variant="primary"><Link to={dest}>{user ? 'Go to dashboard' : 'Sign in'}</Link></Button>
      </div>
    )
  }
  return <div role="status" className="flex items-center justify-center gap-3 py-6 text-muted"><Loader2 className="h-5 w-5 animate-spin" aria-hidden />Verifying your email…</div>
}
