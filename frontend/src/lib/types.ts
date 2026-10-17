export type Status = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
export type Verdict = 'potential_manipulation' | 'no_strong_indicators' | 'inconclusive' | 'failed'

export interface User {
  id: string
  email: string
  display_name: string
  role: 'user' | 'admin'
  email_verified: boolean
  retention_days: number | null
  allow_model_improvement: boolean
  created_at: string
}

export interface AnalysisSummary {
  id: string
  status: Status
  verdict: Verdict | null
  progress: number
  stage: string
  score: number | null
  created_at: string
  finished_at: string | null
  duration_ms: number | null
  filename: string
  media_deleted: boolean
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface Media {
  id: string
  original_filename: string
  size_bytes: number
  container: string
  duration_seconds: number
  width: number
  height: number
  fps: number
  codec: string
  has_audio: boolean
  sha256: string
  created_at: string
  delete_after: string | null
  deleted_at: string | null
}

export interface Frame {
  id: string
  frame_index: number
  timestamp: number
  face_detected: boolean
  /** [x, y, w, h] in source-video pixel coordinates */
  face_box: number[] | null
  track_id: number | null
  score: number | null
  flagged: boolean
  quality: { blur_var?: number; brightness?: number; face_area_ratio?: number; [k: string]: number | undefined }
  note: string
  has_image: boolean
  has_overlay: boolean
}

export interface Interval {
  start: number
  end: number
  mean_score: number
}
export interface Spike {
  from: number
  to: number
  delta: number
}
export interface Temporal {
  performed?: boolean
  reason?: string
  frames_considered?: number
  score_mean?: number
  score_median?: number
  score_std?: number
  mean_abs_frame_delta?: number
  spikes?: Spike[]
  suspicious_intervals?: Interval[]
  pattern?: 'sustained' | 'intermittent' | 'none'
  note?: string
}
export interface Audio {
  status?: string
  reason?: string
  model?: string
  mean_score?: number
  note?: string
  segments?: { start: number; score: number }[]
  sync?: { status?: string; reason?: string }
}
export interface Inference {
  model_name: string
  model_version: string
  modality: string
  device: string
  frames_analyzed: number
  mean_score: number | null
  max_score: number | null
  flagged_fraction: number | null
  duration_ms: number
  details: Record<string, unknown>
}

export interface AnalysisDetail extends AnalysisSummary {
  explanation: string
  limitations: string[]
  temporal: Temporal
  audio: Audio
  config: { manipulation_threshold?: number; inconclusive_low?: number; frame_interval_seconds?: number; max_frames?: number; face_detector?: string; [k: string]: unknown }
  error: string | null
  media: Media
  inferences: Inference[]
  frames: Frame[]
  score_note: string
}

export interface MyStats {
  verdicts: Record<string, number>
  status: Record<string, number>
  total: number
  per_day: { date: string; count: number }[]
}

export interface AdminStats {
  users: number
  analyses: Record<string, number>
  verdicts: Record<string, number>
  queued: number
  media_bytes: number
}
export interface ModelHealth {
  configured_model: string
  revision: string
  device_setting: string
  loaded: boolean
  info: Record<string, unknown>
  thresholds: { manipulation: number; inconclusive_low: number }
  audio_enabled: boolean
  error: string | null
}
export interface AdminUser {
  id: string
  email: string
  role: 'user' | 'admin'
  is_active: boolean
  email_verified: boolean
  created_at: string
  analyses: number
}
export interface AuditEvent {
  id: string
  user_id: string | null
  action: string
  target: string | null
  ip: string | null
  meta: Record<string, unknown> | null
  created_at: string
}
export interface SignedUrl {
  url: string
  expires_at: number
}
