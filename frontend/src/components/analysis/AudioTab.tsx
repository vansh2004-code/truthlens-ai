import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { AnalysisDetail } from '@/lib/types'
import { formatTimestamp } from '@/lib/utils'
import { formatScore, SCORE_LABEL } from '@/lib/verdict'

export function AudioTab({ a }: { a: AnalysisDetail }) {
  const au = a.audio
  const performed = au.status === 'performed'
  const sync = au.sync
  return (
    <div className="space-y-4">
      <Card><CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2"><h3 className="font-semibold">Audio analysis</h3><Badge tone={performed ? 'ok' : 'neutral'}>{performed ? 'Performed' : 'Not performed'}</Badge></div>
        {performed ? (
          <>
            <p className="text-sm">{SCORE_LABEL}: <span className="font-mono">{formatScore(au.mean_score)}</span> (mean over 5-second segments)</p>
            {au.segments && au.segments.length > 0 && <ul className="grid gap-1 text-sm sm:grid-cols-2">{au.segments.map((s, i) => <li key={i} className="flex justify-between rounded border px-2.5 py-1"><span>{formatTimestamp(s.start)}</span><span className="font-mono">{formatScore(s.score)}</span></li>)}</ul>}
            {au.note && <p className="text-xs text-muted">{au.note}</p>}
          </>
        ) : <p className="text-sm text-muted">{au.reason || 'Audio was not analyzed for this video.'}</p>}
      </CardContent></Card>
      <Card><CardContent className="space-y-2 p-5">
        <div className="flex items-center gap-2"><h3 className="font-semibold">Audio-visual synchronization</h3><Badge tone="neutral">{sync?.status === 'performed' ? 'Performed' : 'Not performed'}</Badge></div>
        <p className="text-sm text-muted">{sync?.reason || 'Synchronization analysis was not performed.'}</p>
      </CardContent></Card>
    </div>
  )
}
