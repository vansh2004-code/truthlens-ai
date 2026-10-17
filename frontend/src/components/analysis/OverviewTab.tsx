import { Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AnalysisDetail } from '@/lib/types'
import { formatBytes, formatDate, formatDuration, formatMs } from '@/lib/utils'
import { DEFAULT_THRESHOLD } from '@/lib/constants'
import { formatScore, SCORE_DISCLAIMER, SCORE_LABEL, VERDICT_HELP, VERDICT_LABEL } from '@/lib/verdict'
import { VerdictBadge } from './badges'

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-4 py-1.5 text-sm"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
}

export function OverviewTab({ a }: { a: AnalysisDetail }) {
  const v = a.verdict ?? 'failed'
  const thr = a.config.manipulation_threshold ?? DEFAULT_THRESHOLD
  const inf = a.inferences[0]
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-2"><VerdictBadge verdict={a.verdict} /><h2 className="text-2xl font-semibold tracking-tight">{VERDICT_LABEL[v]}</h2><p className="text-sm text-muted">{VERDICT_HELP[v]}</p></div>
          <div className="flex flex-wrap items-end gap-6 rounded-lg border bg-bg/40 p-4">
            <div><p className="text-xs uppercase tracking-wide text-muted">{SCORE_LABEL}</p><p className="font-mono text-4xl font-semibold tabular-nums">{formatScore(a.score)}</p></div>
            <p className="max-w-sm text-xs leading-5 text-muted">{a.score_note || SCORE_DISCLAIMER} Review threshold for individual frames: {thr.toFixed(2)}.</p>
          </div>
          <div><h3 className="mb-1.5 text-sm font-semibold">Explanation</h3><p className="text-sm leading-6">{a.explanation || 'No explanation was recorded.'}</p></div>
          <div role="note" className="flex gap-2.5 rounded-md border border-warn/30 bg-warn/5 p-3 text-sm"><Info className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden /><p>This result is an uncalibrated model output intended to support human review. It is not proof that media is manipulated or unaltered.</p></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Limitations</CardTitle></CardHeader>
        <CardContent>
          {a.limitations.length ? <ul className="list-disc space-y-2 pl-5 text-sm text-muted">{a.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul> : <p className="text-sm text-muted">No analysis-specific limitations were recorded. General limitations are described in the documentation.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Model</CardTitle></CardHeader>
        <CardContent><dl className="divide-y">
          {inf ? (<>
            <KV k="Model" v={<span className="font-mono text-xs">{inf.model_name}</span>} /><KV k="Version" v={<span className="font-mono text-xs">{inf.model_version}</span>} />
            <KV k="Device" v={inf.device} /><KV k="Frames analyzed" v={inf.frames_analyzed} />
            <KV k="Mean score" v={formatScore(inf.mean_score)} /><KV k="Max score" v={formatScore(inf.max_score)} />
            <KV k="Frames above threshold" v={inf.flagged_fraction == null ? '—' : `${Math.round(inf.flagged_fraction * 100)}% of analyzed`} />
          </>) : <p className="py-2 text-sm text-muted">No model inference was recorded.</p>}
        </dl></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Processing</CardTitle></CardHeader>
        <CardContent><dl className="divide-y">
          <KV k="Processing time" v={formatMs(a.duration_ms)} /><KV k="Submitted" v={formatDate(a.created_at)} /><KV k="Finished" v={formatDate(a.finished_at)} />
          <KV k="Frame interval" v={a.config.frame_interval_seconds != null ? `${a.config.frame_interval_seconds}s` : '—'} />
          <KV k="Face detector" v={a.config.face_detector ?? '—'} />
        </dl></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Source video</CardTitle></CardHeader>
        <CardContent><dl className="divide-y">
          <KV k="File" v={<span className="break-all">{a.media.original_filename}</span>} /><KV k="Size" v={formatBytes(a.media.size_bytes)} />
          <KV k="Duration" v={formatDuration(a.media.duration_seconds)} /><KV k="Resolution" v={`${a.media.width}×${a.media.height}`} />
          <KV k="Frame rate" v={`${a.media.fps.toFixed(2)} fps`} /><KV k="Codec" v={a.media.codec || '—'} />
          <KV k="SHA-256" v={<span className="break-all font-mono text-[10px]">{a.media.sha256}</span>} />
          <KV k="Stored until" v={a.media.deleted_at ? `Deleted ${formatDate(a.media.deleted_at)}` : formatDate(a.media.delete_after)} />
        </dl></CardContent>
      </Card>
    </div>
  )
}
