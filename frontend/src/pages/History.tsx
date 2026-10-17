import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnalysisRow } from '@/components/analysis/AnalysisRow'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { useAnalyses } from '@/lib/queries'
import { useHistoryParams } from '@/lib/useHistoryParams'

const STATUS = [{ value: '', label: 'All statuses' }, { value: 'queued', label: 'Queued' }, { value: 'processing', label: 'Processing' }, { value: 'completed', label: 'Completed' }, { value: 'failed', label: 'Failed' }, { value: 'cancelled', label: 'Cancelled' }]
const VERDICT = [{ value: '', label: 'All outcomes' }, { value: 'potential_manipulation', label: 'Potential manipulation' }, { value: 'no_strong_indicators', label: 'No strong indicators' }, { value: 'inconclusive', label: 'Inconclusive' }, { value: 'failed', label: 'Failed' }]
const SORT = [{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }, { value: 'score', label: 'Highest model score' }]

export default function History() {
  const { params, update } = useHistoryParams()
  const [text, setText] = useState(params.q)
  const q = useAnalyses(params)

  // Debounced search -> URL
  useEffect(() => {
    if (text.trim() === params.q) return
    const t = setTimeout(() => update({ q: text }), 350)
    return () => clearTimeout(t)
  }, [text, params.q, update])

  const data = q.data
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1
  const filtered = !!(params.q || params.status || params.verdict)

  return (
    <div>
      <PageHeader title="History" description="Search and filter all of your analyses." />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]" role="search">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input aria-label="Search by file name or ID" placeholder="Search by file name or ID" className="pl-9" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <Select label="Filter by status" value={params.status} onValueChange={(v) => update({ status: v })} options={STATUS} />
        <Select label="Filter by outcome" value={params.verdict} onValueChange={(v) => update({ verdict: v })} options={VERDICT} />
        <Select label="Sort order" value={params.sort} onValueChange={(v) => update({ sort: v })} options={SORT} />
      </div>
      {q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        : q.isLoading ? <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
        : data && data.items.length === 0 ? (
          <EmptyState title={filtered ? 'No matching analyses' : 'No analyses yet'} description={filtered ? 'Try clearing a filter or changing your search.' : 'Upload a video to get started.'}
            action={filtered ? <Button variant="secondary" onClick={() => { setText(''); update({ q: '', status: '', verdict: '', sort: 'newest' }) }}>Clear filters</Button> : <Button asChild variant="primary"><Link to="/analyze">Analyze a video</Link></Button>} />
        ) : data && (
          <>
            <p className="mb-3 text-sm text-muted" aria-live="polite">{data.total} result{data.total === 1 ? '' : 's'}</p>
            <div className="space-y-3">{data.items.map((a) => <AnalysisRow key={a.id} a={a} />)}</div>
            <nav aria-label="Pagination" className="mt-6 flex items-center justify-between">
              <Button variant="secondary" disabled={data.page <= 1} onClick={() => update({ page: data.page - 1 })}>Previous</Button>
              <span className="text-sm text-muted">Page {data.page} of {pages}</span>
              <Button variant="secondary" disabled={data.page >= pages} onClick={() => update({ page: data.page + 1 })}>Next</Button>
            </nav>
          </>
        )}
    </div>
  )
}
