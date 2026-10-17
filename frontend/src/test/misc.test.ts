import { describe, expect, it } from 'vitest'
import { fillDays } from '@/components/charts/PerDayChart'
import { nearestFrame } from '@/components/analysis/TimelineTab'
import { whyFlagged } from '@/components/analysis/EvidenceTab'
import { safeNext } from '@/lib/safeNext'
import type { Frame } from '@/lib/types'

const frame = (o: Partial<Frame>): Frame => ({ id: 'f', frame_index: 0, timestamp: 0, face_detected: true, face_box: null, track_id: null, score: 0.5, flagged: false, quality: {}, note: '', has_image: true, has_overlay: false, ...o })

describe('helpers', () => {
  it('safeNext blocks open redirects', () => {
    expect(safeNext('/history?x=1')).toBe('/history?x=1')
    expect(safeNext('//evil.com')).toBe('/dashboard')
    expect(safeNext('https://evil.com')).toBe('/dashboard')
    expect(safeNext(null)).toBe('/dashboard')
  })
  it('fillDays yields a continuous window with explicit zeros', () => {
    const d = fillDays([{ date: '2026-10-12', count: 2 }], 3, new Date('2026-10-12T10:00:00Z'))
    expect(d).toEqual([{ date: '2026-10-10', count: 0 }, { date: '2026-10-11', count: 0 }, { date: '2026-10-12', count: 2 }])
  })
  it('nearestFrame ignores unscored frames', () => {
    const frames = [frame({ id: 'a', timestamp: 1 }), frame({ id: 'b', timestamp: 2, score: null }), frame({ id: 'c', timestamp: 5 })]
    expect(nearestFrame(frames, 2.1)?.id).toBe('a')
  })
  it('whyFlagged only states recorded facts', () => {
    const out = whyFlagged(frame({ score: 0.91, quality: { blur_var: 120.5, brightness: 100, face_area_ratio: 0.1 }, note: 'ok' }), 0.7)
    expect(out[0]).toBe('Model score 0.91 is at or above the review threshold of 0.70.')
    expect(out.join(' ')).toContain('face covers 10.0% of the frame')
    expect(out.join(' ')).toContain('Pipeline note: ok')
    expect(out.join(' ')).not.toMatch(/probab|fake|%\s*fake/i)
  })
})
