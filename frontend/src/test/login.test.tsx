import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Login from '@/pages/auth/Login'

const login = vi.fn()
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: null, login }) }))

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(null, { status: 501 }))
  return render(
    <QueryClientProvider client={qc}><MemoryRouter initialEntries={['/login?next=/history']}>
      <Routes><Route path="/login" element={<Login />} /><Route path="/history" element={<div>history page</div>} /></Routes>
    </MemoryRouter></QueryClientProvider>,
  )
}
afterEach(() => { vi.restoreAllMocks(); login.mockReset() })

describe('Login form', () => {
  it('shows validation errors and does not submit invalid data', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })
  it('surfaces the server error message', async () => {
    login.mockRejectedValue(new Error('Incorrect email or password.'))
    setup()
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co')
    await userEvent.type(screen.getByLabelText('Password'), 'whatever')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.')
  })
  it('navigates to the safe return path on success', async () => {
    login.mockResolvedValue({})
    setup()
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co')
    await userEvent.type(screen.getByLabelText('Password'), 'whatever')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(screen.getByText('history page')).toBeInTheDocument())
  })
})
