import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/ui/states'
import { DEFAULT_THRESHOLD } from '@/lib/constants'
import type { AnalysisDetail, Frame } from '@/lib/types'
import { cn, formatTimestamp } from '@/lib/utils'
import { formatScore, SCORE_LABEL } from '@/lib/verdict'
import { FrameImage } from './FrameImage'

export function QualityList({ f }: { f: Frame }) {
  const q = f.quality
  const rows: [string, string][] = []
  if (q.blur_var != null) rows.push(['Sharpness (Laplacian variance)', q.blur_var.toFixed(1)])
  if (q.brightness != null) rows.push(['Brightness (0–255)', q.brightness.toFixed(1)])
  if (q.face_area_ratio != null) rows.push(['Face area / frame', `${(q.face_area_ratio * 100).toFixed(1)}%`])
  if (!rows.length) return <p className="text-sm text-muted">No quality metrics recorded.</p>
  return <dl className="divide-y text-sm">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-1.5"><dt className="text-muted">{k}</dt><dd className="font-mono">{v}</dd></div>)}</dl>
}

export function FramesTab({ a, selectedId, onSelect }: { a: AnalysisDetail; selectedId: string | null; onSelect: (id: string) => void }) {
  const frames = a.frames
  const idx = Math.max(0, frames.findIndex((f) => f.id === selectedId))
  const f = frames[idx]
  const thr = a.config.manipulation_threshold ?? DEFAULT_THRESHOLD
  const [overlay, setOverlay] = useState(false)
  const [box, setBox] = useState(true)
  const strip = useRef<HTMLDivElement>(null)

  useEffect(() => {
    strip.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [idx])

  if (!f) return <EmptyState title="No frames recorded" description="This analysis has no extracted frames." />
  const go = (d: number) => onSelect(frames[Math.min(frames.length - 1, Math.max(0, idx + d))]!.id)
  const showOverlay = overlay && f.has_overlay
  const w = a.media.width || 1
  const h = a.media.height || 1

  return (
    <div
      className="space-y-4"
      onKeyDown={(e) => {
        if (e.target instanceof HTMLElement && ['INPUT', 'BUTTON'].includes(e.target.tagName) && e.target.getAttribute('role') === 'switch') return
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
        if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
      }}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card><CardContent className="space-y-3 p-4">
          <div className="relative mx-auto w-full overflow-hidden rounded-md bg-black" style={{ aspectRatio: `${w} / ${h}`, maxHeight: '60vh' }}>
            <FrameImage analysisId={a.id} frame={f} kind={showOverlay ? 'overlay' : 'image'} className="absolute inset-0 h-full w-full object-contain" />
            {box && f.face_box && f.face_box.length === 4 && f.has_image && (
              <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
                <rect x={f.face_box[0]} y={f.face_box[1]} width={f.face_box[2]} height={f.face_box[3]} fill="none" stroke={f.flagged ? '#f87171' : '#60a5fa'} strokeWidth={Math.max(2, w / 300)} strokeDasharray={f.flagged ? undefined : '8 5'} />
              </svg>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button size="icon" variant="secondary" aria-label="Previous frame" disabled={idx === 0} onClick={() => go(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="min-w-[8rem] text-center text-sm" aria-live="polite">Frame {idx + 1} of {frames.length}</span>
              <Button size="icon" variant="secondary" aria-label="Next frame" disabled={idx === frames.length - 1} onClick={() => go(1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2"><Switch checked={box} onCheckedChange={setBox} aria-label="Show face box" />Face box</label>
              <label className={cn('flex items-center gap-2', !f.has_overlay && 'opacity-50')}><Switch checked={overlay && f.has_overlay} onCheckedChange={setOverlay} disabled={!f.has_overlay} aria-label="Show saliency overlay" />Saliency overlay</label>
            </div>
          </div>
          <p className="text-xs text-muted">Use the left and right arrow keys to move between frames. Saliency highlights regions that influenced the model score; it is indicative, not proof. {!f.has_overlay && 'No saliency overlay exists for this frame (overlays are only rendered for the highest-scoring frames).'}</p>
        </CardContent></Card>

        <Card><CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2"><Badge tone={f.flagged ? 'danger' : 'neutral'}>{f.flagged ? 'Above review threshold' : 'Below review threshold'}</Badge>{!f.face_detected && <Badge tone="warn">No usable face</Badge>}</div>
          <div><p className="text-xs uppercase tracking-wide text-muted">{SCORE_LABEL}</p><p className="font-mono text-3xl font-semibold">{formatScore(f.score)}</p><p className="text-xs text-muted">Threshold {thr.toFixed(2)} · Time {formatTimestamp(f.timestamp)} · Frame index {f.frame_index}{f.track_id != null && ` · Track ${f.track_id}`}</p></div>
          <div><h4 className="mb-1 text-sm font-semibold">Quality metrics</h4><QualityList f={f} /></div>
          <div><h4 className="mb-1 text-sm font-semibold">Notes</h4><p className="text-sm text-muted">{f.note || 'No notes for this frame.'}</p></div>
        </CardContent></Card>
      </div>

      <div ref={strip} className="flex gap-2 overflow-x-auto pb-2" role="listbox" aria-label="Frame filmstrip">
        {frames.map((fr, i) => (
          <button key={fr.id} role="option" aria-selected={i === idx} aria-current={i === idx ? 'true' : undefined} aria-label={`Frame ${i + 1}, ${formatTimestamp(fr.timestamp)}, score ${formatScore(fr.score)}${fr.flagged ? ', above threshold' : ''}`} onClick={() => onSelect(fr.id)} className={cn('relative h-16 w-24 shrink-0 overflow-hidden rounded-md border-2', i === idx ? 'border-primary' : fr.flagged ? 'border-danger/60' : 'border-transparent')}>
            <FrameImage analysisId={a.id} frame={fr} alt="" className="h-full w-full" />
            <span className="absolute inset-x-0 bottom-0 bg-black/70 px-1 text-[10px] font-mono">{formatScore(fr.score)}{fr.flagged ? ' ▲' : ''}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
