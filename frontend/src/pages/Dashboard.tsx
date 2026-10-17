import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Layers, Loader2, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AnalysisRow } from '@/components/analysis/AnalysisRow'
import { PerDayChart } from '@/components/charts/PerDayChart'
import { VerdictChart } from '@/components/charts/VerdictChart'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { useAuth } from '@/lib/auth'
import { useAnalyses, useMyStats } from '@/lib/queries'

function Stat({ label, value, icon: Icon, i }: { label: string; value: number; icon: typeof Layers; i: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
      <Card><CardContent className="flex items-center gap-4 p-5">
        <div className="rounded-md bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" aria-hidden /></div>
        <div><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="text-xs text-muted">{label}</p></div>
      </CardContent></Card>
    </motion.div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const stats = useMyStats()
  const recent = useAnalyses({ page_size: 5 }, { refetchInterval: 5000 })
  const s = stats.data
  const inFlight = (s?.status.queued ?? 0) + (s?.status.processing ?? 0)

  return (
    <div>
      <PageHeader
        title={`Welcome${user?.display_name ? `, ${user.display_name}` : ''}`}
        description="Your analysis activity. All numbers come from your own account."
        actions={<Button asChild variant="primary"><Link to="/analyze"><Upload className="h-4 w-4" aria-hidden />Analyze a video</Link></Button>}
      />
      {stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
      ) : stats.isLoading || !s ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : s.total === 0 ? (
        <EmptyState title="No analyses yet" description="Upload a video to run your first analysis. Results appear here with charts and a history." action={<Button asChild variant="primary"><Link to="/analyze">Upload your first video</Link></Button>} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat i={0} label="Total analyses" value={s.total} icon={Layers} />
            <Stat i={1} label="Completed" value={s.status.completed ?? 0} icon={CheckCircle2} />
            <Stat i={2} label="In progress" value={inFlight} icon={Loader2} />
            <Stat i={3} label="Potential manipulation" value={s.verdicts.potential_manipulation ?? 0} icon={AlertTriangle} />
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card><CardContent className="p-5"><PerDayChart perDay={s.per_day} /></CardContent></Card>
            <Card><CardContent className="p-5"><VerdictChart verdicts={s.verdicts} /></CardContent></Card>
          </div>
        </>
      )}
      <section className="mt-8" aria-labelledby="recent-h">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent-h" className="text-lg font-semibold">Recent analyses</h2>
          <Link to="/history" className="text-sm text-primary underline underline-offset-4">View all</Link>
        </div>
        {recent.isLoading ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
          : recent.isError ? <ErrorState error={recent.error} onRetry={() => void recent.refetch()} />
          : recent.data && recent.data.items.length > 0 ? <div className="space-y-3">{recent.data.items.map((a) => <AnalysisRow key={a.id} a={a} />)}</div>
          : <p className="text-sm text-muted">Nothing here yet.</p>}
      </section>
    </div>
  )
}
