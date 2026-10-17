import { ListChecks, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { StatusBadge } from '@/components/analysis/badges'
import { api, errorMessage } from '@/lib/api'
import { POLL_MS } from '@/lib/constants'
import { useAnalyses, useInvalidateAnalyses } from '@/lib/queries'
import { stageLabel } from '@/lib/verdict'
import { formatDate } from '@/lib/utils'
import { useState } from 'react'
import type { AnalysisSummary } from '@/lib/types'

export default function Queue() {
  const toast = useToast()
  const inv = useInvalidateAnalyses()
  const [busy, setBusy] = useState<string | null>(null)
  const queued = useAnalyses({ status: 'queued', page_size: 50 }, { refetchInterval: POLL_MS })
  const processing = useAnalyses({ status: 'processing', page_size: 50 }, { refetchInterval: POLL_MS })
  const items: AnalysisSummary[] = [...(processing.data?.items ?? []), ...(queued.data?.items ?? [])]
  const loading = queued.isLoading || processing.isLoading
  const err = queued.error ?? processing.error

  const cancel = async (id: string) => {
    setBusy(id)
    try {
      await api(`/api/analyses/${id}/cancel`, { method: 'POST' })
      toast.success('Analysis cancelled.')
      inv()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  return (
    <div>
      <PageHeader title="Processing queue" description="Live view of your queued and running analyses. Updates every 2 seconds." actions={<Button asChild variant="secondary"><Link to="/analyze">New analysis</Link></Button>} />
      {err ? <ErrorState error={err} onRetry={() => { void queued.refetch(); void processing.refetch() }} />
        : loading ? <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        : items.length === 0 ? <EmptyState icon={<ListChecks className="h-6 w-6" aria-hidden />} title="Nothing in the queue" description="No analyses are queued or running right now." action={<Button asChild variant="primary"><Link to="/analyze">Analyze a video</Link></Button>} />
        : <ul className="space-y-3">{items.map((a) => (
          <li key={a.id}><Card><CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0"><Link to={`/analyses/${a.id}`} className="block truncate font-medium hover:underline">{a.filename}</Link><p className="text-xs text-muted">Submitted {formatDate(a.created_at)}</p></div>
              <div className="flex items-center gap-2"><StatusBadge status={a.status} />
                <Button size="sm" variant="danger" loading={busy === a.id} onClick={() => void cancel(a.id)} aria-label={`Cancel ${a.filename}`}><X className="h-3.5 w-3.5" aria-hidden />Cancel</Button></div>
            </div>
            <Progress value={a.progress} label={`Progress for ${a.filename}`} />
            <p className="text-xs text-muted">{stageLabel(a.stage)} · {Math.round(a.progress * 100)}%</p>
          </CardContent></Card></li>
        ))}</ul>}
    </div>
  )
}
