import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RequireAdmin, RequireAuth } from '@/components/guards'

const auth = vi.hoisted(() => ({ value: { user: null as null | { role: string }, loading: false } }))
vi.mock('@/lib/auth', () => ({ useAuth: () => auth.value }))

const Where = () => { const l = useLocation(); return <div>login page {l.search}</div> }
function app(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<Where />} />
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<div>dashboard</div>} />
          <Route element={<RequireAdmin />}><Route path="/admin" element={<div>admin area</div>} /></Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => { auth.value = { user: null, loading: false } })

describe('route guards', () => {
  it('redirects unauthenticated users to /login preserving the return path', () => {
    app('/dashboard')
    expect(screen.getByText(/login page/)).toHaveTextContent('next=%2Fdashboard')
  })
  it('shows a loading state while the session is checked', () => {
    auth.value = { user: null, loading: true }
    app('/dashboard')
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
  it('lets authenticated users in', () => {
    auth.value = { user: { role: 'user' }, loading: false }
    app('/dashboard')
    expect(screen.getByText('dashboard')).toBeInTheDocument()
  })
  it('blocks non-admins from /admin', () => {
    auth.value = { user: { role: 'user' }, loading: false }
    app('/admin')
    expect(screen.queryByText('admin area')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/administrator access required/i)
  })
  it('allows admins into /admin', () => {
    auth.value = { user: { role: 'admin' }, loading: false }
    app('/admin')
    expect(screen.getByText('admin area')).toBeInTheDocument()
  })
})
