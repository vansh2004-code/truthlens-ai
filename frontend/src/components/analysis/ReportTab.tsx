import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Download, Link2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { API_BASE } from '@/lib/constants'
import { errorMessage } from '@/lib/api'
import { createReportLink, downloadReport, useDeleteAnalysis, useDeleteMedia } from '@/lib/queries'
import type { AnalysisDetail } from '@/lib/types'

function Confirm({ trigger, title, description, confirmLabel, onConfirm, pending }: { trigger: React.ReactNode; title: string; description: string; confirmLabel: string; onConfirm: () => Promise<void>; pending: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <DialogContent title={title} description={description}>
        <div className="flex justify-end gap-2">
          <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
          <Button variant="danger" loading={pending} onClick={() => void onConfirm().then(() => setOpen(false)).catch(() => undefined)}>{confirmLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ReportTab({ a }: { a: AnalysisDetail }) {
  const toast = useToast()
  const nav = useNavigate()
  const del = useDeleteAnalysis()
  const delMedia = useDeleteMedia(a.id)
  const ready = a.status === 'completed'
  const dl = useMutation({ mutationFn: (f: 'pdf' | 'json') => downloadReport(a.id, f), onError: (e) => toast.error(errorMessage(e)) })
  const link = useMutation({
    mutationFn: async (f: 'pdf' | 'json') => {
      const r = await createReportLink(a.id, f)
      const full = new URL(`${API_BASE}${r.url}`, window.location.origin).toString()
      try {
        await navigator.clipboard.writeText(full)
        toast.success(`Link copied. It expires ${new Date(r.expires_at * 1000).toLocaleTimeString()}.`)
      } catch {
        window.prompt('Copy this expiring link:', full)
      }
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <div className="space-y-4">
      <Card><CardContent className="space-y-4 p-5">
        <div><h3 className="font-semibold">Download report</h3><p className="text-sm text-muted">{ready ? 'Reports contain the verdict, explanation, limitations and per-frame data. They do not include video.' : 'Reports are available once the analysis has completed.'}</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={!ready} loading={dl.isPending && dl.variables === 'pdf'} onClick={() => dl.mutate('pdf')}><Download className="h-4 w-4" aria-hidden />Download PDF</Button>
          <Button variant="secondary" disabled={!ready} loading={dl.isPending && dl.variables === 'json'} onClick={() => dl.mutate('json')}><Download className="h-4 w-4" aria-hidden />Download JSON</Button>
        </div>
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button variant="outline" disabled={!ready} loading={link.isPending && link.variables === 'pdf'} onClick={() => link.mutate('pdf')}><Link2 className="h-4 w-4" aria-hidden />Copy expiring PDF link</Button>
          <Button variant="outline" disabled={!ready} loading={link.isPending && link.variables === 'json'} onClick={() => link.mutate('json')}><Link2 className="h-4 w-4" aria-hidden />Copy expiring JSON link</Button>
        </div>
        <p className="text-xs text-muted">Expiring links work without signing in until they expire (about 5 minutes). Share them only with people you trust.</p>
      </CardContent></Card>

      <Card><CardContent className="space-y-4 p-5">
        <div><h3 className="font-semibold">Delete data</h3><p className="text-sm text-muted">Deleting is permanent.</p></div>
        <div className="flex flex-wrap gap-2">
          <Confirm trigger={<Button variant="danger" disabled={a.media_deleted || a.status === 'processing'}><Trash2 className="h-4 w-4" aria-hidden />Delete video and frames</Button>}
            title="Delete video and frames?" description="The stored video and extracted frame images are removed now. Numeric results and reports remain, but frame images will no longer display and the analysis cannot be re-run."
            confirmLabel="Delete media" pending={delMedia.isPending}
            onConfirm={async () => { try { await delMedia.mutateAsync(); toast.success('Video and frames deleted.') } catch (e) { toast.error(errorMessage(e)); throw e } }} />
          <Confirm trigger={<Button variant="danger"><Trash2 className="h-4 w-4" aria-hidden />Delete analysis</Button>}
            title="Delete this analysis?" description="The analysis, its results, frames and the stored video (if no other analysis uses it) are permanently deleted."
            confirmLabel="Delete analysis" pending={del.isPending}
            onConfirm={async () => { try { await del.mutateAsync(a.id); toast.success('Analysis deleted.'); nav('/history') } catch (e) { toast.error(errorMessage(e)); throw e } }} />
        </div>
        {a.media_deleted && <p className="text-xs text-muted">The source video has already been deleted.</p>}
      </CardContent></Card>
    </div>
  )
}
