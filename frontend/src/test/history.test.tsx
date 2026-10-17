import { act, render, renderHook, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { historyQueryString } from '@/lib/queries'
import { parseHistoryParams, useHistoryParams } from '@/lib/useHistoryParams'

describe('history filters -> query params', () => {
  it('omits defaults', () => {
    expect(historyQueryString({ q: '', status: '', verdict: '', sort: 'newest', page: 1, page_size: 20 })).toBe('')
  })
  it('encodes all filters for the API', () => {
    const qs = historyQueryString({ q: ' clip a ', status: 'completed', verdict: 'inconclusive', sort: 'score', page: 3, page_size: 50 })
    const sp = new URLSearchParams(qs)
    expect(Object.fromEntries(sp)).toEqual({ q: 'clip a', status: 'completed', verdict: 'inconclusive', sort: 'score', page: '3', page_size: '50' })
  })
  it('parses and sanitizes URL params', () => {
    expect(parseHistoryParams(new URLSearchParams('sort=bogus&page=-2&status=failed'))).toMatchObject({ sort: 'newest', page: 1, status: 'failed' })
    expect(parseHistoryParams(new URLSearchParams('page=4')).page).toBe(4)
  })
  it('syncs filter changes to the URL and resets the page', () => {
    let loc = ''
    const Probe = () => { loc = useLocation().search; return null }
    const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter initialEntries={['/history?page=3']}>{children}<Probe /></MemoryRouter>
    const { result } = renderHook(() => useHistoryParams(), { wrapper })
    expect(result.current.params.page).toBe(3)
    act(() => result.current.update({ verdict: 'potential_manipulation' }))
    expect(new URLSearchParams(loc).get('verdict')).toBe('potential_manipulation')
    expect(new URLSearchParams(loc).get('page')).toBeNull()
    render(<div>done</div>)
    expect(screen.getByText('done')).toBeInTheDocument()
  })
})
