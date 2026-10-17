import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, downloadBlob, uploadFile } from './api'
import { POLL_MS } from './constants'
import type { AdminStats, AdminUser, AnalysisDetail, AnalysisSummary, AuditEvent, MyStats, Page, SignedUrl, User } from './types'

export const isActive = (s?: string) => s === 'queued' || s === 'processing'

export interface HistoryParams {
  q: string
  status: string
  verdict: string
  sort: string
  page: number
  page_size: number
}

export function historyQueryString(p: Partial<HistoryParams>): string {
  const sp = new URLSearchParams()
  if (p.q?.trim()) sp.set('q', p.q.trim())
  if (p.status) sp.set('status', p.status)
  if (p.verdict) sp.set('verdict', p.verdict)
  if (p.sort && p.sort !== 'newest') sp.set('sort', p.sort)
  if (p.page && p.page > 1) sp.set('page', String(p.page))
  if (p.page_size && p.page_size !== 20) sp.set('page_size', String(p.page_size))
  return sp.toString()
}

export function useAnalyses(p: Partial<HistoryParams>, opts: { refetchInterval?: number | false } = {}) {
  const qs = historyQueryString(p)
  return useQuery({
    queryKey: ['analyses', qs],
    queryFn: () => api<Page<AnalysisSummary>>(`/api/analyses${qs ? `?${qs}` : ''}`),
    placeholderData: keepPreviousData,
    refetchInterval: opts.refetchInterval ?? false,
  })
}

export function useMyStats() {
  return useQuery({ queryKey: ['stats'], queryFn: () => api<MyStats>('/api/analyses/stats') })
}

export function useAnalysis(id: string) {
  return useQuery({
    queryKey: ['analysis', id],
    queryFn: () => api<AnalysisDetail>(`/api/analyses/${id}`),
    refetchInterval: (q) => (isActive(q.state.data?.status) ? POLL_MS : false),
    retry: (n, e) => !(e instanceof Error && 'status' in e && [403, 404].includes((e as { status: number }).status)) && n < 2,
  })
}

export function useInvalidateAnalyses() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['analyses'] })
    void qc.invalidateQueries({ queryKey: ['stats'] })
  }
}

export function useUpload() {
  const inv = useInvalidateAnalyses()
  return useMutation({
    mutationFn: ({ file, onProgress, signal }: { file: File; onProgress: (f: number) => void; signal?: AbortSignal }) =>
      uploadFile<AnalysisSummary>('/api/analyses', file, onProgress, signal),
    onSuccess: inv,
  })
}

export function useAnalysisAction(id: string, action: 'retry' | 'cancel') {
  const qc = useQueryClient()
  const inv = useInvalidateAnalyses()
  return useMutation({
    mutationFn: () => api<AnalysisSummary>(`/api/analyses/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['analysis', id] })
      inv()
    },
  })
}

export function useDeleteAnalysis() {
  const inv = useInvalidateAnalyses()
  return useMutation({ mutationFn: (id: string) => api<void>(`/api/analyses/${id}`, { method: 'DELETE' }), onSuccess: inv })
}

export function useDeleteMedia(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>(`/api/analyses/${id}/media`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['analysis', id] })
    },
  })
}

export const downloadReport = (id: string, fmt: 'pdf' | 'json') => downloadBlob(`/api/analyses/${id}/report.${fmt}`, `truthlens-${id}.${fmt}`)
export const createReportLink = (id: string, fmt: 'pdf' | 'json') => api<SignedUrl>(`/api/analyses/${id}/report-link/${fmt}`, { method: 'POST' })

export const frameImageUrl = (analysisId: string, frameId: string, kind: 'image' | 'overlay') =>
  `${(import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''}/api/analyses/${analysisId}/frames/${frameId}/${kind}`

export function useAdminStats() {
  return useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api<AdminStats>('/api/admin/stats'), retry: false })
}
export function useAdminUsers() {
  return useQuery({ queryKey: ['admin', 'users'], queryFn: () => api<AdminUser[]>('/api/admin/users'), retry: false })
}
export function useAudit(limit = 100) {
  return useQuery({ queryKey: ['admin', 'audit', limit], queryFn: () => api<AuditEvent[]>(`/api/admin/audit?limit=${limit}`), retry: false })
}

export type { User }
