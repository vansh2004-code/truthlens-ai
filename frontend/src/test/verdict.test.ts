import { describe, expect, it } from 'vitest'
import type { Verdict } from '@/lib/types'
import { formatScore, SCORE_LABEL, VERDICT_HELP, VERDICT_LABEL, verdictLabel } from '@/lib/verdict'

describe('verdict labels', () => {
  it('uses the mandated wording', () => {
    expect(VERDICT_LABEL.potential_manipulation).toBe('Potential manipulation detected')
    expect(VERDICT_LABEL.no_strong_indicators).toBe('No strong manipulation indicators detected')
    expect(VERDICT_LABEL.inconclusive).toBe('Inconclusive')
    expect(VERDICT_LABEL.failed).toBe('Analysis failed')
  })
  it('never claims authenticity or safety', () => {
    const all = [...Object.values(VERDICT_LABEL), ...Object.values(VERDICT_HELP), SCORE_LABEL].join(' ')
    expect(all).not.toMatch(/authentic|\breal\b|\bsafe\b|genuine|verified/i)
  })
  it('handles null and unknown verdicts', () => {
    expect(verdictLabel(null)).toBe('Pending')
    expect(verdictLabel('weird' as Verdict)).toBe('Unknown outcome')
  })
  it('formats scores as plain numbers, never percentages', () => {
    expect(formatScore(0.8234)).toBe('0.82')
    expect(formatScore(null)).toBe('—')
    expect(formatScore(0.5)).not.toContain('%')
    expect(SCORE_LABEL).toBe('Model score (uncalibrated)')
  })
})
