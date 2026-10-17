import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { HistoryParams } from './queries'

export const SORTS = ['newest', 'oldest', 'score']

/** URL <-> filter state. Defaults are omitted from the URL. */
export function parseHistoryParams(sp: URLSearchParams): HistoryParams {
  const page = Number(sp.get('page'))
  const sort = sp.get('sort') ?? 'newest'
  return {
    q: sp.get('q') ?? '',
    status: sp.get('status') ?? '',
    verdict: sp.get('verdict') ?? '',
    sort: SORTS.includes(sort) ? sort : 'newest',
    page: Number.isInteger(page) && page > 1 ? page : 1,
    page_size: 20,
  }
}

export function useHistoryParams() {
  const [sp, setSp] = useSearchParams()
  const params = useMemo(() => parseHistoryParams(sp), [sp])
  const update = useCallback(
    (patch: Partial<HistoryParams>) => {
      const next = { ...params, ...patch }
      if (!('page' in patch)) next.page = 1 // changing a filter resets paging
      const out = new URLSearchParams()
      if (next.q.trim()) out.set('q', next.q.trim())
      if (next.status) out.set('status', next.status)
      if (next.verdict) out.set('verdict', next.verdict)
      if (next.sort !== 'newest') out.set('sort', next.sort)
      if (next.page > 1) out.set('page', String(next.page))
      setSp(out, { replace: true })
    },
    [params, setSp],
  )
  return { params, update }
}
