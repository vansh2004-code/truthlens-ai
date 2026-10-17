import { AlertTriangle, CheckCircle2, CircleHelp, Loader2, XCircle, Ban, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Status, Verdict } from '@/lib/types'
import { STATUS_LABEL, VERDICT_LABEL, VERDICT_TONE } from '@/lib/verdict'

const ICON = {
  potential_manipulation: AlertTriangle,
  no_strong_indicators: CheckCircle2,
  inconclusive: CircleHelp,
  failed: XCircle,
} as const

/** Icon + text + colour: colour is never the only encoding. */
export function VerdictBadge({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) return <Badge tone="neutral"><Clock className="h-3 w-3" aria-hidden />Pending</Badge>
  const Icon = ICON[verdict] ?? CircleHelp
  return <Badge tone={VERDICT_TONE[verdict]}><Icon className="h-3 w-3" aria-hidden />{VERDICT_LABEL[verdict]}</Badge>
}

export function StatusBadge({ status }: { status: Status }) {
  const tone = status === 'completed' ? 'ok' : status === 'failed' ? 'danger' : status === 'processing' ? 'info' : 'neutral'
  const Icon = status === 'processing' ? Loader2 : status === 'completed' ? CheckCircle2 : status === 'failed' ? XCircle : status === 'cancelled' ? Ban : Clock
  return <Badge tone={tone}><Icon className={status === 'processing' ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} aria-hidden />{STATUS_LABEL[status] ?? status}</Badge>
}
