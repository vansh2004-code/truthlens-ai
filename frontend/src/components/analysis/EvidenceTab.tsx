import { ShieldAlert } from 'lucide-react'
import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/states'
import { DEFAULT_THRESHOLD } from '@/lib/constants'
import type { AnalysisDetail, Frame } from '@/lib/types'
import { formatTimestamp } from '@/lib/utils'
import { formatScore, SCORE_LABEL } from '@/lib/verdict'
import { FrameImage } from './FrameImage'

/** Builds the "why flagged" statements from recorded data only. No inference beyond the numbers. */
export function whyFlagged(f: Frame, threshold: number): string[] {
  const out: string[] = []
  if (f.score != null) out.push(`Model score ${f.score.toFixed(2)} is ${f.score >= threshold ? 'at or above' : 'below'} the review threshold of ${threshold.toFixed(2)}.`)
  const q = f.quality
  const bits: string[] = []
  if (q.blur_var != null) bits.push(`sharpness ${q.blur_var.toFixed(1)}`)
  if (q.brightness != null) bits.push(`brightness ${q.brightness.toFixed(0)}/255`)
  if (q.face_area_ratio != null) bits.push(`face covers ${(q.face_area_ratio * 100).toFixed(1)}% of the frame`)
  if (bits.length) out.push(`Recorded quality: ${bits.join(', ')}.`)
  if (f.note) out.push(`Pipeline note: ${f.note}`)
  return out
}

export function EvidenceTab({ a, onOpen }: { a: AnalysisDetail; onOpen: (id: string) => void }) {
  const thr = a.config.manipulation_threshold ?? DEFAULT_THRESHOLD
  const flagged = useMemo(() => a.frames.filter((f) => f.flagged && f.score != null).sort((x, y) => (y.score ?? 0) - (x.score ?? 0)), [a.frames])
  return (
    <div className="space-y-4">
      <div role="note" className="flex gap-2.5 rounded-md border border-warn/30 bg-warn/5 p-3 text-sm"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden /><p>Saliency overlays are indicative, not proof. They show where the model's output was most sensitive; they do not demonstrate how or whether media was manipulated.</p></div>
      {flagged.length === 0 ? <EmptyState title="No flagged frames" description={`No frame scored at or above the review threshold of ${thr.toFixed(2)}.`} /> : (
        <ul className="grid gap-4 md:grid-cols-2">
          {flagged.map((f) => (
            <li key={f.id}><Card><CardContent className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-2">
                <FrameImage analysisId={a.id} frame={f} className="aspect-video w-full rounded-md" />
                <FrameImage analysisId={a.id} frame={f} kind="overlay" className="aspect-video w-full rounded-md" alt={`Saliency overlay at ${f.timestamp.toFixed(1)} seconds`} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><Badge tone="danger">{SCORE_LABEL}: {formatScore(f.score)}</Badge> <span className="ml-1 text-xs text-muted">at {formatTimestamp(f.timestamp)}</span></div>
                <Button size="sm" variant="secondary" onClick={() => onOpen(f.id)}>Open in viewer</Button>
              </div>
              <div><h4 className="text-sm font-semibold">Why flagged</h4><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">{whyFlagged(f, thr).map((s, i) => <li key={i}>{s}</li>)}</ul></div>
            </CardContent></Card></li>
          ))}
        </ul>
      )}
    </div>
  )
}
