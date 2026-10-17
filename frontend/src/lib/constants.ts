/** Single source of truth for client-side limits. Must mirror backend config (TL_MAX_UPLOAD_MB, validation.py). */
export const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi'] as const
const envMax = Number(import.meta.env.VITE_MAX_UPLOAD_MB)
export const MAX_UPLOAD_MB = Number.isFinite(envMax) && envMax > 0 ? envMax : 200
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
export const MIN_UPLOAD_BYTES = 1024
const envDur = Number(import.meta.env.VITE_MAX_DURATION_SECONDS)
export const MAX_DURATION_SECONDS = Number.isFinite(envDur) && envDur > 0 ? envDur : 300
/** Default review threshold; the real value is read from each analysis' config when present. */
export const DEFAULT_THRESHOLD = 0.7
export const DEFAULT_INCONCLUSIVE_LOW = 0.4
export const MAX_ACTIVE_JOBS = 3
export const POLL_MS = 2000
export const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export const STAGES = [
  'queued',
  'loading_model',
  'extracting_frames',
  'detecting_faces',
  'running_model',
  'rendering_evidence',
  'temporal_analysis',
  'audio',
  'done',
] as const
