import { AlertTriangle, Check, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/toast'
import { errorMessage } from '@/lib/api'
import { STAGES } from '@/lib/constants'
import { useAnalysisAction } from '@/lib/queries'
import type { AnalysisDetail } from '@/lib/types'
import { cn } from '@/lib/utils'
import { stageLabel } from '@/lib/verdict'
import { StatusBadge } from './badges'

export function ProcessingView({ a }: { a: AnalysisDetail }) {
  const toast = useToast()
  const retry = useAnalysisAction(a.id, 'retry')
  const cancel = useAnalysisAction(a.id, 'cancel')
  const failed = a.status === 'failed'
  const cancelled = a.status === 'cancelled'
  const idx = STAGES.indexOf(a.stage as (typeof STAGES)[number])

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold">{failed ? 'Analysis failed' : cancelled ? 'Analysis cancelled' : 'Analysis in progress'}</h2>
            <p className="text-sm text-muted">{failed || cancelled ? stageLabel(a.stage) : `${stageLabel(a.stage)}…`}</p></div>
          <StatusBadge status={a.status} />
        </div>
        {!failed && !cancelled && <div className="space-y-1.5"><Progress value={a.progress} label="Analysis progress" /><p className="text-xs text-muted" aria-live="polite">{Math.round(a.progress * 100)}% · stage: {stageLabel(a.stage)}</p></div>}
        {failed && (
          <div role="alert" className="flex gap-3 rounded-md border border-danger/40 bg-danger/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
            <p>{a.error ?? 'The analysis could not be completed.'}</p>
          </div>
        )}
        <ol className="grid gap-2 sm:grid-cols-2" aria-label="Processing stages">
          {STAGES.filter((s) => s !== 'done').map((s, i) => {
            const state = failed || cancelled ? (i < idx ? 'done' : 'todo') : i < idx ? 'done' : i === idx ? 'active' : 'todo'
            return (
              <li key={s} aria-current={state === 'active' ? 'step' : undefined} className={cn('flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm', state === 'active' && 'border-primary/50 bg-primary/10', state === 'todo' && 'text-muted')}>
                {state === 'done' ? <Check className="h-4 w-4 text-ok" aria-hidden /> : state === 'active' ? <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden /> : <span className="h-4 w-4 rounded-full border" aria-hidden />}
                {stageLabel(s)}<span className="sr-only">{state === 'done' ? ' (complete)' : state === 'active' ? ' (current)' : ' (pending)'}</span>
              </li>
            )
          })}
        </ol>
        <div className="flex flex-wrap gap-2">
          {(failed || cancelled) && !a.media_deleted && (
            <Button variant="primary" loading={retry.isPending} onClick={() => retry.mutate(undefined, { onError: (e) => toast.error(errorMessage(e)), onSuccess: () => toast.success('Analysis re-queued.') })}><RotateCcw className="h-4 w-4" aria-hidden />Retry</Button>
          )}
          {(failed || cancelled) && a.media_deleted && <p className="text-sm text-muted">The source video was deleted, so this analysis cannot be re-run.</p>}
          {!failed && !cancelled && <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate(undefined, { onError: (e) => toast.error(errorMessage(e)) })}>Cancel analysis</Button>}
        </div>
      </CardContent>
    </Card>
  )
}
