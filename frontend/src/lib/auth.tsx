import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { api, ApiError, setAuthFailureHandler } from './api'
import type { User } from './types'

interface AuthCtx {
  user: User | null
  loading: boolean
  login: (b: { email: string; password: string }) => Promise<User>
  register: (b: { email: string; password: string; display_name: string }) => Promise<User>
  logout: () => Promise<void>
  setUser: (u: User) => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children, onAuthFailure }: { children: ReactNode; onAuthFailure?: (returnTo: string) => void }) {
  const qc = useQueryClient()
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api<User>('/api/auth/me', { noRedirect: true })
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    staleTime: 60_000,
    retry: false,
  })

  useEffect(() => {
    setAuthFailureHandler((returnTo) => {
      qc.setQueryData(['me'], null)
      onAuthFailure?.(returnTo)
    })
    return () => setAuthFailureHandler(null)
  }, [qc, onAuthFailure])

  const loginM = useMutation({ mutationFn: (b: { email: string; password: string }) => api<User>('/api/auth/login', { method: 'POST', json: b, noRefresh: true }) })
  const registerM = useMutation({ mutationFn: (b: { email: string; password: string; display_name: string }) => api<User>('/api/auth/register', { method: 'POST', json: b, noRefresh: true }) })

  const setUser = useCallback((u: User) => qc.setQueryData(['me'], u), [qc])
  const login = useCallback(async (b: { email: string; password: string }) => {
    const u = await loginM.mutateAsync(b)
    qc.clear()
    qc.setQueryData(['me'], u)
    return u
  }, [loginM, qc])
  const register = useCallback(async (b: { email: string; password: string; display_name: string }) => {
    const u = await registerM.mutateAsync(b)
    qc.clear()
    qc.setQueryData(['me'], u)
    return u
  }, [registerM, qc])
  const logout = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST', noRefresh: true })
    } finally {
      qc.clear()
      qc.setQueryData(['me'], null)
    }
  }, [qc])

  const value = useMemo<AuthCtx>(
    () => ({ user: me.data ?? null, loading: me.isLoading, login, register, logout, setUser }),
    [me.data, me.isLoading, login, register, logout, setUser],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth must be used within AuthProvider')
  return c
}
