import { ChevronRight, Film } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Progress } from '@/components/ui/progress'
import type { AnalysisSummary } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { formatScore, SCORE_LABEL, stageLabel } from '@/lib/verdict'
import { StatusBadge, VerdictBadge } from './badges'

export function AnalysisRow({ a }: { a: AnalysisSummary }) {
  const active = a.status === 'queued' || a.status === 'processing'
  return (
    <Link to={`/analyses/${a.id}`} className="group flex items-center gap-4 rounded-lg border bg-surface/60 p-4 transition-colors hover:border-primary/50 hover:bg-elevated/50">
      <div className="hidden rounded-md bg-elevated p-2.5 text-muted sm:block"><Film className="h-5 w-5" aria-hidden /></div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{a.filename}</span>
          {active ? <StatusBadge status={a.status} /> : a.status === 'completed' ? <VerdictBadge verdict={a.verdict} /> : <StatusBadge status={a.status} />}
        </div>
        {active ? (
          <div className="space-y-1"><Progress value={a.progress} label={`Progress for ${a.filename}`} /><p className="text-xs text-muted">{stageLabel(a.stage)} · {Math.round(a.progress * 100)}%</p></div>
        ) : (
          <p className="text-xs text-muted">{formatDate(a.created_at)}{a.status === 'completed' && a.score != null && <> · {SCORE_LABEL}: <span className="font-mono text-fg">{formatScore(a.score)}</span></>}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  )
}
