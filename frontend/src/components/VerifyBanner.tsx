import { useMutation } from '@tanstack/react-query'
import { MailWarning } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'

export function VerifyBanner() {
  const { user } = useAuth()
  const toast = useToast()
  const resend = useMutation({
    mutationFn: () => api('/api/auth/resend-verification', { method: 'POST' }),
    onSuccess: () => toast.success('Verification email sent. Check your inbox.'),
    onError: (e) => toast.error(errorMessage(e)),
  })
  if (!user || user.email_verified) return null
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 border-b border-warn/30 bg-warn/10 px-4 py-2.5 text-sm">
      <MailWarning className="h-4 w-4 shrink-0 text-warn" aria-hidden />
      <span className="flex-1">Verify your email address ({user.email}) to unlock uploads if your administrator requires it.</span>
      <Button size="sm" variant="secondary" loading={resend.isPending} onClick={() => resend.mutate()}>Resend email</Button>
    </div>
  )
}
