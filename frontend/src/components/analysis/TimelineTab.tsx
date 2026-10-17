import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART, ChartFrame, tooltipStyle } from '@/components/charts/ChartFrame'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/states'
import { DEFAULT_THRESHOLD } from '@/lib/constants'
import type { AnalysisDetail, Frame } from '@/lib/types'
import { formatTimestamp } from '@/lib/utils'

interface Pt { t: number; score: number; id: string; flagged: boolean }

/** Frame closest in time to t among frames that have a score. */
export function nearestFrame(frames: Frame[], t: number): Frame | undefined {
  let best: Frame | undefined
  for (const f of frames) if (f.score != null && (!best || Math.abs(f.timestamp - t) < Math.abs(best.timestamp - t))) best = f
  return best
}

interface DotProps { cx?: number; cy?: number; payload?: Pt }
function makeDot(onSelect: (id: string) => void) {
  return function Dot({ cx, cy, payload }: DotProps) {
    if (cx == null || cy == null || !payload) return <g />
    const common = { onClick: () => onSelect(payload.id), style: { cursor: 'pointer' } }
    // Flagged frames are diamonds, others circles: shape + colour.
    return payload.flagged
      ? <rect {...common} x={cx - 5} y={cy - 5} width={10} height={10} transform={`rotate(45 ${cx} ${cy})`} fill={CHART.danger} stroke="#0A0D14" />
      : <circle {...common} cx={cx} cy={cy} r={4} fill={CHART.primary} stroke="#0A0D14" />
  }
}

export function TimelineTab({ a, onJump }: { a: AnalysisDetail; onJump: (frameId: string) => void }) {
  const thr = a.config.manipulation_threshold ?? DEFAULT_THRESHOLD
  const data: Pt[] = a.frames.filter((f) => f.score != null).map((f) => ({ t: f.timestamp, score: f.score as number, id: f.id, flagged: f.flagged }))
  const tm = a.temporal
  if (data.length === 0) return <EmptyState title="No scored frames" description="No frames had a usable face, so there is no score timeline." />
  const intervals = tm.suspicious_intervals ?? []
  const spikes = tm.spikes ?? []
  const jumpTo = (t: number) => { const f = nearestFrame(a.frames, t); if (f) onJump(f.id) }

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-5">
        <ChartFrame
          height={320}
          title="Model score over time"
          description={`Per-frame model score (uncalibrated) versus video time. Dashed line: review threshold ${thr.toFixed(2)}. Diamonds mark frames above the threshold; shaded bands mark suspicious intervals. Click a point to open that frame.`}
          srTable={<table><caption>Per-frame model scores</caption><thead><tr><th>Time (s)</th><th>Score</th><th>Above threshold</th></tr></thead><tbody>{data.map((d) => <tr key={d.id}><td>{d.t}</td><td>{d.score.toFixed(3)}</td><td>{d.flagged ? 'yes' : 'no'}</td></tr>)}</tbody></table>}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 16, left: -10, bottom: 18 }}>
              <CartesianGrid stroke={CHART.grid} />
              <XAxis type="number" dataKey="t" domain={['dataMin', 'dataMax']} tick={{ fill: CHART.axis, fontSize: 11 }} stroke={CHART.grid} tickFormatter={(v: number) => `${Math.round(v)}s`} label={{ value: 'Video time', position: 'insideBottom', offset: -10, fill: CHART.axis, fontSize: 11 }} />
              <YAxis domain={[0, 1]} tick={{ fill: CHART.axis, fontSize: 11 }} stroke={CHART.grid} label={{ value: 'Model score', angle: -90, position: 'insideLeft', fill: CHART.axis, fontSize: 11 }} />
              {intervals.map((iv, i) => <ReferenceArea key={i} x1={iv.start} x2={iv.end} fill={CHART.danger} fillOpacity={0.15} stroke={CHART.danger} strokeOpacity={0.5} strokeDasharray="3 3" />)}
              <ReferenceLine y={thr} stroke={CHART.warn} strokeDasharray="6 4" label={{ value: `threshold ${thr.toFixed(2)}`, fill: CHART.warn, fontSize: 11, position: 'insideTopRight' }} />
              <Tooltip {...tooltipStyle} labelFormatter={(v) => `t = ${formatTimestamp(Number(v))}`} formatter={(v) => [Number(v).toFixed(3), 'Model score']} />
              <Line type="linear" dataKey="score" stroke={CHART.primary} strokeWidth={2} dot={makeDot(onJump)} activeDot={makeDot(onJump)} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartFrame>
      </CardContent></Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardContent className="space-y-3 p-5">
          <h3 className="font-semibold">Suspicious intervals</h3>
          {intervals.length === 0 ? <p className="text-sm text-muted">No consecutive runs of frames above the threshold.</p> : (
            <ul className="space-y-2">{intervals.map((iv, i) => (
              <li key={i} className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm">
                <span>{formatTimestamp(iv.start)} – {formatTimestamp(iv.end)} <span className="text-muted">· mean score {iv.mean_score.toFixed(2)}</span></span>
                <Button size="sm" variant="secondary" onClick={() => jumpTo(iv.start)}>Open frame</Button>
              </li>))}</ul>
          )}
        </CardContent></Card>
        <Card><CardContent className="space-y-3 p-5">
          <h3 className="font-semibold">Score spikes</h3>
          {spikes.length === 0 ? <p className="text-sm text-muted">No unusually large frame-to-frame changes.</p> : (
            <ul className="space-y-2">{spikes.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm">
                <span>{formatTimestamp(s.from)} → {formatTimestamp(s.to)} <span className="text-muted">· change {s.delta.toFixed(2)}</span></span>
                <Button size="sm" variant="secondary" onClick={() => jumpTo(s.to)}>Open frame</Button>
              </li>))}</ul>
          )}
        </CardContent></Card>
      </div>

      <Card><CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">Temporal statistics</h3>{tm.pattern && <Badge tone={tm.pattern === 'none' ? 'neutral' : 'warn'}>Pattern: {tm.pattern}</Badge>}</div>
        {tm.performed ? (
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {([['Frames considered', tm.frames_considered], ['Mean', tm.score_mean?.toFixed(3)], ['Median', tm.score_median?.toFixed(3)], ['Std. deviation', tm.score_std?.toFixed(3)]] as const).map(([k, v]) => <div key={k}><dt className="text-muted">{k}</dt><dd className="font-mono">{v ?? '—'}</dd></div>)}
          </dl>
        ) : <p className="text-sm text-muted">Temporal analysis was not performed. {tm.reason}</p>}
        {tm.note && <p className="text-xs text-muted">{tm.note}</p>}
      </CardContent></Card>
    </div>
  )
}
