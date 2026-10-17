import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AudioTab } from '@/components/analysis/AudioTab'
import { EvidenceTab } from '@/components/analysis/EvidenceTab'
import { FramesTab } from '@/components/analysis/FramesTab'
import { OverviewTab } from '@/components/analysis/OverviewTab'
import { ProcessingView } from '@/components/analysis/ProcessingView'
import { ReportTab } from '@/components/analysis/ReportTab'
import { TimelineTab } from '@/components/analysis/TimelineTab'
import { PageHeader } from '@/components/layout/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApiError } from '@/lib/api'
import { useAnalysis } from '@/lib/queries'
import { VerdictBadge } from '@/components/analysis/badges'
import { Button } from '@/components/ui/button'

export default function AnalysisPage() {
  const { id = '' } = useParams()
  const q = useAnalysis(id)
  const [tab, setTab] = useState('overview')
  const [frameId, setFrameId] = useState<string | null>(null)
  const a = q.data

  const openFrame = (fid: string) => { setFrameId(fid); setTab('frames') }

  if (q.isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-64" /></div>
  if (q.isError || !a) {
    const nf = q.error instanceof ApiError && q.error.status === 404
    return <ErrorState error={q.error} title={nf ? 'Analysis not found' : 'Could not load analysis'} onRetry={nf ? undefined : () => void q.refetch()} />
  }
  const done = a.status === 'completed'
  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2"><Link to="/history"><ArrowLeft className="h-4 w-4" aria-hidden />History</Link></Button>
      <PageHeader title={a.filename} description={<span className="flex flex-wrap items-center gap-2">{done && <VerdictBadge verdict={a.verdict} />}<span className="font-mono text-xs">ID {a.id}</span></span>} />
      {!done ? <ProcessingView a={a} /> : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList aria-label="Analysis sections">
            {['overview', 'frames', 'timeline', 'evidence', 'audio', 'report'].map((t) => <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>)}
          </TabsList>
          <TabsContent value="overview"><OverviewTab a={a} /></TabsContent>
          <TabsContent value="frames"><FramesTab a={a} selectedId={frameId ?? a.frames.find((f) => f.flagged)?.id ?? a.frames[0]?.id ?? null} onSelect={setFrameId} /></TabsContent>
          <TabsContent value="timeline"><TimelineTab a={a} onJump={openFrame} /></TabsContent>
          <TabsContent value="evidence"><EvidenceTab a={a} onOpen={openFrame} /></TabsContent>
          <TabsContent value="audio"><AudioTab a={a} /></TabsContent>
          <TabsContent value="report"><ReportTab a={a} /></TabsContent>
        </Tabs>
      )}
    </div>
  )
}
