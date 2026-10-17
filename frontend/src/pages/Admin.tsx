import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Cpu, RefreshCw, Trash } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/api'
import { useAdminStats, useAdminUsers, useAudit } from '@/lib/queries'
import { formatBytes, formatDate } from '@/lib/utils'
import type { AdminUser, ModelHealth } from '@/lib/types'

function Stats() {
  const s = useAdminStats()
  const qc = useQueryClient()
  const toast = useToast()
  const purge = useMutation({
    mutationFn: () => api<Record<string, unknown>>('/api/admin/purge', { method: 'POST' }),
    onSuccess: (r) => { toast.success(`Purge finished: ${Object.entries(r).map(([k, v]) => `${k} ${String(v)}`).join(', ') || 'nothing to purge'}`); void qc.invalidateQueries({ queryKey: ['admin'] }) },
    onError: (e) => toast.error(errorMessage(e)),
  })
  if (s.isError) return <ErrorState error={s.error} onRetry={() => void s.refetch()} />
  if (!s.data) return <Skeleton className="h-28" />
  const d = s.data
  const items: [string, string | number][] = [['Users', d.users], ['Queued / running', d.queued], ['Stored media', formatBytes(d.media_bytes)], ...Object.entries(d.analyses).map(([k, v]) => [`Analyses: ${k}`, v] as [string, number])]
  return (
    <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>System statistics</CardTitle>
      <Button size="sm" variant="secondary" loading={purge.isPending} onClick={() => purge.mutate()}><Trash className="h-3.5 w-3.5" aria-hidden />Purge expired media</Button></CardHeader>
      <CardContent><dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">{items.map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="text-xl font-semibold tabular-nums">{v}</dd></div>)}</dl>
        {Object.keys(d.verdicts).length > 0 && <p className="mt-4 text-xs text-muted">Outcomes (completed): {Object.entries(d.verdicts).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(' · ')}</p>}</CardContent></Card>
  )
}

function Model() {
  const q = useMutation({ mutationFn: (load: boolean) => api<ModelHealth>(`/api/admin/model-health?load=${load}`) })
  const data = q.data
  return (
    <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Model health</CardTitle>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" loading={q.isPending && q.variables === false} onClick={() => q.mutate(false)}><RefreshCw className="h-3.5 w-3.5" aria-hidden />Check status</Button>
        <Button size="sm" variant="primary" loading={q.isPending && q.variables === true} onClick={() => q.mutate(true)}><Cpu className="h-3.5 w-3.5" aria-hidden />Load model now</Button>
      </div></CardHeader>
      <CardContent>
        {q.isError ? <ErrorState error={q.error} /> : !data ? <p className="text-sm text-muted">Choose "Check status" to query model state, or "Load model now" to load it into memory (may take a while).</p> : (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2"><Badge tone={data.loaded ? 'ok' : 'warn'}>{data.loaded ? 'Loaded' : 'Not loaded'}</Badge><Badge tone="neutral">Audio {data.audio_enabled ? 'enabled' : 'disabled'}</Badge></div>
            {data.error && <p role="alert" className="text-danger">{data.error}</p>}
            <dl className="grid gap-2 sm:grid-cols-2">
              <div><dt className="text-muted">Configured model</dt><dd className="break-all font-mono text-xs">{data.configured_model}@{data.revision}</dd></div>
              <div><dt className="text-muted">Device setting</dt><dd>{data.device_setting}</dd></div>
              <div><dt className="text-muted">Manipulation threshold</dt><dd className="font-mono">{data.thresholds.manipulation}</dd></div>
              <div><dt className="text-muted">Inconclusive lower bound</dt><dd className="font-mono">{data.thresholds.inconclusive_low}</dd></div>
            </dl>
            <pre className="max-h-48 overflow-auto rounded-md bg-bg/60 p-3 font-mono text-xs">{JSON.stringify(data.info, null, 2)}</pre>
          </div>)}
      </CardContent></Card>
  )
}

function UserRow({ u }: { u: AdminUser }) {
  const qc = useQueryClient()
  const toast = useToast()
  const patch = useMutation({
    mutationFn: (body: { is_active?: boolean; role?: string }) => api(`/api/admin/users/${u.id}`, { method: 'PATCH', json: body }),
    onSuccess: () => { toast.success('User updated.'); void qc.invalidateQueries({ queryKey: ['admin', 'users'] }) },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <TR>
      <TD className="font-medium">{u.email}</TD>
      <TD><Select label={`Role for ${u.email}`} value={u.role} onValueChange={(r) => r !== u.role && patch.mutate({ role: r })} options={[{ value: 'user', label: 'User' }, { value: 'admin', label: 'Admin' }]} className="h-8 min-w-[6rem]" /></TD>
      <TD><Badge tone={u.is_active ? 'ok' : 'danger'}>{u.is_active ? 'Active' : 'Disabled'}</Badge>{!u.email_verified && <Badge tone="warn" className="ml-1">Unverified</Badge>}</TD>
      <TD className="tabular-nums">{u.analyses}</TD>
      <TD className="text-muted">{formatDate(u.created_at)}</TD>
      <TD><Button size="sm" variant={u.is_active ? 'danger' : 'secondary'} loading={patch.isPending} onClick={() => patch.mutate({ is_active: !u.is_active })} aria-label={`${u.is_active ? 'Deactivate' : 'Activate'} ${u.email}`}>{u.is_active ? 'Deactivate' : 'Activate'}</Button></TD>
    </TR>
  )
}

function Users() {
  const q = useAdminUsers()
  return (
    <Card><CardHeader><CardTitle>Users</CardTitle></CardHeader><CardContent>
      {q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : !q.data ? <Skeleton className="h-32" /> : (
        <Table><THead><TR><TH>Email</TH><TH>Role</TH><TH>Status</TH><TH>Analyses</TH><TH>Joined</TH><TH>Action</TH></TR></THead><TBody>{q.data.map((u) => <UserRow key={u.id} u={u} />)}</TBody></Table>
      )}
      <p className="mt-3 text-xs text-muted">You cannot change your own role or status.</p>
    </CardContent></Card>
  )
}

function Audit() {
  const q = useAudit(100)
  return (
    <Card><CardHeader><CardTitle>Audit log</CardTitle></CardHeader><CardContent>
      {q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : !q.data ? <Skeleton className="h-32" /> : q.data.length === 0 ? <p className="text-sm text-muted">No events recorded.</p> : (
        <Table><THead><TR><TH>Time</TH><TH>Action</TH><TH>Actor</TH><TH>Target</TH><TH>IP</TH></TR></THead><TBody>{q.data.map((e) => (
          <TR key={e.id}><TD className="whitespace-nowrap text-muted">{formatDate(e.created_at)}</TD><TD className="font-mono text-xs">{e.action}</TD><TD className="font-mono text-xs">{e.user_id?.slice(0, 8) ?? '—'}</TD><TD className="font-mono text-xs">{e.target?.slice(0, 12) ?? '—'}</TD><TD className="font-mono text-xs">{e.ip ?? '—'}</TD></TR>
        ))}</TBody></Table>
      )}
    </CardContent></Card>
  )
}

export default function Admin() {
  return (
    <div>
      <PageHeader title="Administration" description="System health, users and audit trail." />
      <div className="space-y-5"><Stats /><Model /><Users /><Audit /></div>
    </div>
  )
}
