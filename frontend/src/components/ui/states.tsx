import { AlertTriangle, Inbox } from 'lucide-react'
import type { ReactNode } from 'react'
import { ApiError } from '@/lib/api'
import { Button } from './button'

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center">
      <div className="rounded-full bg-elevated p-3 text-muted">{icon ?? <Inbox className="h-6 w-6" aria-hidden />}</div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }: { error: unknown; onRetry?: () => void; title?: string }) {
  const msg = error instanceof Error ? error.message : 'Unexpected error.'
  const forbidden = error instanceof ApiError && error.status === 403
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-danger/30 bg-danger/5 px-6 py-12 text-center">
      <AlertTriangle className="h-6 w-6 text-danger" aria-hidden />
      <h3 className="text-base font-semibold">{forbidden ? 'Access denied' : title}</h3>
      <p className="max-w-md text-sm text-muted">{msg}</p>
      {onRetry && !forbidden && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
    </div>
  )
}
