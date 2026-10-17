import type { Status, Verdict } from './types'

/** Honest-language labels. Never use "authentic", "real", "safe", or percent-fake wording. */
export const VERDICT_LABEL: Record<Verdict, string> = {
  potential_manipulation: 'Potential manipulation detected',
  no_strong_indicators: 'No strong manipulation indicators detected',
  inconclusive: 'Inconclusive',
  failed: 'Analysis failed',
}

export const VERDICT_HELP: Record<Verdict, string> = {
  potential_manipulation: 'The model scored enough face frames above the review threshold to warrant human review. This is not proof.',
  no_strong_indicators: 'The model did not find strong indicators. This does not establish that the media is unaltered.',
  inconclusive: 'The evidence is not strong enough in either direction, or too few usable face frames were found.',
  failed: 'The analysis could not be completed.',
}

export type Tone = 'danger' | 'ok' | 'warn' | 'neutral' | 'info'

export const VERDICT_TONE: Record<Verdict, Tone> = {
  potential_manipulation: 'danger',
  no_strong_indicators: 'info',
  inconclusive: 'warn',
  failed: 'neutral',
}

export function verdictLabel(v: Verdict | null | undefined): string {
  return v ? (VERDICT_LABEL[v] ?? 'Unknown outcome') : 'Pending'
}

export const STATUS_LABEL: Record<Status, string> = {
  queued: 'Queued',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export const STAGE_LABEL: Record<string, string> = {
  starting: 'Starting',
  queued: 'Waiting in queue',
  loading_model: 'Loading model',
  extracting_frames: 'Extracting frames',
  detecting_faces: 'Detecting faces',
  running_model: 'Running model',
  rendering_evidence: 'Rendering evidence',
  temporal_analysis: 'Temporal analysis',
  audio: 'Audio check',
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export function stageLabel(s: string): string {
  return STAGE_LABEL[s] ?? s.replace(/_/g, ' ')
}

/** Raw model score on a 0–1 scale, rendered as a plain number (never as a percentage or probability). */
export function formatScore(score: number | null | undefined): string {
  return score == null ? '—' : score.toFixed(2)
}

export const SCORE_LABEL = 'Model score (uncalibrated)'
export const SCORE_DISCLAIMER = 'An uncalibrated model output between 0 and 1. It is not a probability that the media is fake.'
