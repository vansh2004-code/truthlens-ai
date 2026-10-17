import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, parseErrorBody, setAuthFailureHandler } from '@/lib/api'

const json = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status })

beforeEach(() => {
  document.cookie = 'tl_csrf=tok123; path=/'
})
afterEach(() => {
  vi.restoreAllMocks()
  setAuthFailureHandler(null)
  document.cookie = 'tl_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
})

describe('api client', () => {
  it('sends credentials and CSRF header on non-GET requests only', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(200, { ok: true }))
    await api('/api/analyses')
    await api('/api/auth/logout', { method: 'POST' })
    const [, getInit] = f.mock.calls[0]!
    const [, postInit] = f.mock.calls[1]!
    expect((getInit!.headers as Record<string, string>)['X-CSRF-Token']).toBeUndefined()
    expect((postInit!.headers as Record<string, string>)['X-CSRF-Token']).toBe('tok123')
    expect(postInit!.credentials).toBe('include')
  })

  it('refreshes once on 401 then retries the original request', async () => {
    const calls: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const u = String(input)
      calls.push(u)
      if (u.endsWith('/api/auth/refresh')) return json(200, {})
      return calls.filter((c) => c.endsWith('/api/analyses/stats')).length === 1 ? json(401, { error: { code: 'invalid_token', message: 'expired' } }) : json(200, { total: 1 })
    })
    const r = await api<{ total: number }>('/api/analyses/stats')
    expect(r.total).toBe(1)
    expect(calls).toEqual(['/api/analyses/stats', '/api/auth/refresh', '/api/analyses/stats'])
  })

  it('refresh request carries the CSRF header', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => (String(input).endsWith('/refresh') ? json(200, {}) : f.mock.calls.length > 1 ? json(200, {}) : json(401, {})))
    await api('/api/analyses')
    const refreshCall = f.mock.calls.find((c) => String(c[0]).endsWith('/refresh'))!
    expect((refreshCall[1]!.headers as Record<string, string>)['X-CSRF-Token']).toBe('tok123')
  })

  it('calls the auth-failure handler with the return path when refresh fails', async () => {
    const handler = vi.fn()
    setAuthFailureHandler(handler)
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(401, { error: { code: 'not_authenticated', message: 'Sign in' } }))
    await expect(api('/api/analyses')).rejects.toMatchObject({ status: 401, code: 'not_authenticated' })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0]![0]).toContain('/')
  })

  it('does not redirect when noRedirect is set', async () => {
    const handler = vi.fn()
    setAuthFailureHandler(handler)
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(401, {}))
    await expect(api('/api/auth/me', { noRedirect: true })).rejects.toBeInstanceOf(ApiError)
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not attempt refresh for noRefresh calls (login)', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(401, { error: { code: 'invalid_credentials', message: 'Incorrect email or password.' } }))
    await expect(api('/api/auth/login', { method: 'POST', json: {}, noRefresh: true })).rejects.toThrow('Incorrect email or password.')
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('maps network failures to ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('failed'))
    await expect(api('/api/x')).rejects.toMatchObject({ code: 'network_error', status: 0 })
  })

  it('returns undefined for 204', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(null, { status: 204 }))
    expect(await api('/api/auth/logout', { method: 'POST' })).toBeUndefined()
  })
})

describe('error parsing', () => {
  it('parses the standard error shape and field errors', () => {
    const e = parseErrorBody(422, JSON.stringify({ error: { code: 'validation_error', message: 'Some fields are invalid.', details: [{ field: 'email', message: 'bad' }] } }))
    expect(e.code).toBe('validation_error')
    expect(e.message).toBe('Some fields are invalid.')
    expect(e.fieldErrors).toEqual({ email: 'bad' })
  })
  it('parses weak_password string[] details', () => {
    const e = parseErrorBody(422, JSON.stringify({ error: { code: 'weak_password', message: 'x', details: ['Include at least one digit.'] } }))
    expect(e.problems).toEqual(['Include at least one digit.'])
  })
  it('falls back gracefully for non-JSON bodies', () => {
    const e = parseErrorBody(502, '<html>Bad gateway</html>')
    expect(e.code).toBe('http_error')
    expect(e.message).toContain('502')
  })
})
