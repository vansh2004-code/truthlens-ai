import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '@/components/ErrorBoundary'

afterEach(() => vi.restoreAllMocks())

function Bomb({ explode }: { explode: boolean }) {
  if (explode) throw new Error('kaboom')
  return <p>fine</p>
}

describe('ErrorBoundary', () => {
  it('renders children normally', () => {
    render(<ErrorBoundary><Bomb explode={false} /></ErrorBoundary>)
    expect(screen.getByText('fine')).toBeInTheDocument()
  })
  it('shows a fallback and recovers via Try again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    function Harness() {
      const [boom, setBoom] = useState(true)
      return <><button onClick={() => setBoom(false)}>fix</button><ErrorBoundary><Bomb explode={boom} /></ErrorBoundary></>
    }
    render(<Harness />)
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    await userEvent.click(screen.getByText('fix'))
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('fine')).toBeInTheDocument()
  })
})
