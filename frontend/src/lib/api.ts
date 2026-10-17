import { API_BASE } from './constants'

export class ApiError extends Error {
  status: number
  code: string
  details: unknown
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
  /** Field-level validation messages, if the server provided them. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {}
    if (Array.isArray(this.details)) {
      for (const d of this.details) {
        if (d && typeof d === 'object' && 'field' in d && 'message' in d) out[String((d as { field: string }).field)] = String((d as { message: string }).message)
      }
    }
    return out
  }
  /** Password-policy problems (weak_password details is string[]). */
  get problems(): string[] {
    return Array.isArray(this.details) ? this.details.filter((x): x is string => typeof x === 'string') : []
  }
}

export function readCookie(name: string): string | null {
  const m = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null
}

export const CSRF_COOKIE = 'tl_csrf'
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

let onAuthFailure: ((returnTo: string) => void) | null = null
export function setAuthFailureHandler(fn: ((returnTo: string) => void) | null) {
  onAuthFailure = fn
}

export function parseErrorBody(status: number, text: string): ApiError {
  try {
    const j = JSON.parse(text) as { error?: { code?: string; message?: string; details?: unknown }; detail?: unknown }
    if (j.error && typeof j.error === 'object') {
      return new ApiError(status, j.error.code ?? 'error', j.error.message ?? `Request failed (${status})`, j.error.details)
    }
  } catch {
    /* not JSON */
  }
  return new ApiError(status, status === 0 ? 'network_error' : 'http_error', status === 0 ? 'Network error. Check your connection and try again.' : `Request failed (${status}).`)
}

function url(path: string): string {
  return path.startsWith('http') ? path : `${API_BASE}${path}`
}

let refreshing: Promise<boolean> | null = null
/** Single-flight refresh so concurrent 401s trigger one rotation. */
export function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(url('/api/auth/refresh'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-CSRF-Token': readCookie(CSRF_COOKIE) ?? '' },
        })
        return res.ok
      } catch {
        return false
      }
    })().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

export interface RequestOptions {
  method?: string
  json?: unknown
  body?: BodyInit
  /** Do not attempt token refresh / login redirect on 401 (auth endpoints, probes). */
  noRefresh?: boolean
  /** Try refresh on 401 but never redirect to /login on failure. */
  noRedirect?: boolean
  signal?: AbortSignal
}

function csrfHeaders(method: string): Record<string, string> {
  return SAFE.has(method) ? {} : { 'X-CSRF-Token': readCookie(CSRF_COOKIE) ?? '' }
}

function failAuth(opts: RequestOptions) {
  if (!opts.noRedirect && onAuthFailure) onAuthFailure(window.location.pathname + window.location.search)
}

async function rawRequest(path: string, opts: RequestOptions = {}): Promise<Response> {
  const method = (opts.method ?? 'GET').toUpperCase()
  const headers: Record<string, string> = { ...csrfHeaders(method) }
  let body = opts.body
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.json)
  }
  const attempt = async () => {
    try {
      return await fetch(url(path), { method, credentials: 'include', headers: { ...headers, ...csrfHeaders(method) }, body, signal: opts.signal })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      throw new ApiError(0, 'network_error', 'Network error. Check your connection and try again.')
    }
  }
  let res = await attempt()
  if (res.status === 401 && !opts.noRefresh) {
    if (await refreshSession()) {
      res = await attempt()
    }
    if (res.status === 401) {
      failAuth(opts)
    }
  }
  return res
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await rawRequest(path, opts)
  if (!res.ok) throw parseErrorBody(res.status, await res.text())
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export async function downloadBlob(path: string, filename: string, opts: RequestOptions = {}): Promise<void> {
  const res = await rawRequest(path, opts)
  if (!res.ok) throw parseErrorBody(res.status, await res.text())
  const blob = await res.blob()
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}

/** Upload with real progress via XHR (fetch has no upload progress events). */
export function uploadFile<T>(path: string, file: File, onProgress: (fraction: number) => void, signal?: AbortSignal, retried = false): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url(path))
    xhr.withCredentials = true
    xhr.setRequestHeader('X-CSRF-Token', readCookie(CSRF_COOKIE) ?? '')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.onerror = () => reject(new ApiError(0, 'network_error', 'Network error during upload. Check your connection and try again.'))
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))
    xhr.onload = async () => {
      if (xhr.status === 401 && !retried) {
        if (await refreshSession()) {
          uploadFile<T>(path, file, onProgress, signal, true).then(resolve, reject)
          return
        }
        failAuth({})
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T)
        } catch {
          reject(new ApiError(xhr.status, 'bad_response', 'Unexpected server response.'))
        }
      } else {
        reject(parseErrorBody(xhr.status, xhr.responseText))
      }
    }
    signal?.addEventListener('abort', () => xhr.abort())
    const fd = new FormData()
    fd.append('file', file)
    xhr.send(fd)
  })
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error) return e.message
  return 'Something went wrong.'
}
