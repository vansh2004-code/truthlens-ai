import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Download, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import type { z } from 'zod'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/toast'
import { api, ApiError, downloadBlob, errorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useInvalidateAnalyses } from '@/lib/queries'
import type { User } from '@/lib/types'
import { changePasswordSchema } from '@/lib/validation'

type PwValues = z.infer<typeof changePasswordSchema>

function Profile({ user }: { user: User }) {
  const { setUser } = useAuth()
  const toast = useToast()
  const [name, setName] = useState(user.display_name)
  const [days, setDays] = useState(user.retention_days ? String(user.retention_days) : '')
  const daysNum = days === '' ? null : Number(days)
  const daysBad = daysNum !== null && (!Number.isInteger(daysNum) || daysNum < 1 || daysNum > 365)
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<User>('/api/users/me', { method: 'PATCH', json: body }),
    onSuccess: (u) => { setUser(u); toast.success('Settings saved.') },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <Card>
      <CardHeader><CardTitle>Profile</CardTitle><CardDescription>{user.email}</CardDescription></CardHeader>
      <CardContent>
        <form className="max-w-md space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate({ display_name: name }) }}>
          <Field label="Display name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" variant="secondary" loading={save.isPending} disabled={!name.trim() || name === user.display_name}>Save name</Button>
        </form>
        <div className="mt-6 max-w-md space-y-3 border-t pt-5">
          <h4 className="text-sm font-semibold">Media retention</h4>
          <p className="text-sm text-muted">Uploaded videos and extracted frames are deleted automatically after this many days. Leave blank to use the server default.</p>
          <form className="flex items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (!daysBad) save.mutate({ retention_days: daysNum }) }}>
            <div className="flex-1"><label htmlFor="ret" className="mb-1.5 block text-sm font-medium">Retention (days, 1–365)</label><Input id="ret" inputMode="numeric" value={days} aria-invalid={daysBad} onChange={(e) => setDays(e.target.value)} placeholder="Server default" /></div>
            <Button type="submit" variant="secondary" disabled={daysBad} loading={save.isPending}>Save</Button>
          </form>
          {daysBad && <p role="alert" className="text-xs text-danger">Enter a whole number between 1 and 365.</p>}
          <p className="text-xs text-muted">Applies to videos you upload after saving.</p>
        </div>
        <div className="mt-6 flex max-w-xl items-start justify-between gap-4 border-t pt-5">
          <div>
            <label htmlFor="improve" className="text-sm font-semibold">Allow model improvement</label>
            <p className="mt-1 text-sm text-muted">Off by default. When on, you allow your uploads to be used to improve detection models. When off, your media is never used for training. You can change this at any time.</p>
          </div>
          <Switch id="improve" checked={user.allow_model_improvement} disabled={save.isPending} onCheckedChange={(v) => save.mutate({ allow_model_improvement: v })} />
        </div>
      </CardContent>
    </Card>
  )
}

function Password() {
  const toast = useToast()
  const [problems, setProblems] = useState<string[]>([])
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<PwValues>({ resolver: zodResolver(changePasswordSchema) })
  const onSubmit = async (v: PwValues) => {
    setProblems([])
    try {
      await api('/api/auth/change-password', { method: 'POST', json: v })
      toast.success('Password changed.')
      reset()
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'weak_password') setProblems(e.problems)
        else if (e.code === 'invalid_credentials') setError('current_password', { message: e.message })
        else toast.error(e.message)
      } else toast.error(errorMessage(e))
    }
  }
  return (
    <Card>
      <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-md space-y-4">
          <Field label="Current password" type="password" autoComplete="current-password" error={errors.current_password?.message} {...register('current_password')} />
          <Field label="New password" type="password" autoComplete="new-password" hint="At least 10 characters with upper and lower case letters and a digit." error={errors.new_password?.message} {...register('new_password')} />
          {problems.length > 0 && <ul role="alert" className="list-disc space-y-1 pl-5 text-xs text-danger">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
          <Button type="submit" variant="secondary" loading={isSubmitting}>Change password</Button>
        </form>
      </CardContent>
    </Card>
  )
}

function Data() {
  const toast = useToast()
  const nav = useNavigate()
  const { logout } = useAuth()
  const inv = useInvalidateAnalyses()
  const [pw, setPw] = useState('')
  const [pwErr, setPwErr] = useState<string | null>(null)
  const [openDelAcct, setOpenDelAcct] = useState(false)
  const [openMedia, setOpenMedia] = useState(false)
  const exp = useMutation({ mutationFn: () => downloadBlob('/api/users/me/export', 'truthlens-export.json'), onSuccess: () => toast.success('Export downloaded.'), onError: (e) => toast.error(errorMessage(e)) })
  const delMedia = useMutation({
    mutationFn: () => api('/api/users/me/delete-all-media', { method: 'POST' }),
    onSuccess: () => { toast.success('All stored videos and frames were deleted.'); setOpenMedia(false); inv() },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const delAcct = useMutation({
    mutationFn: () => api('/api/users/me/delete-account', { method: 'POST', json: { password: pw } }),
    onSuccess: async () => { setOpenDelAcct(false); await logout().catch(() => undefined); nav('/', { replace: true }) },
    onError: (e) => setPwErr(errorMessage(e)),
  })
  return (
    <Card>
      <CardHeader><CardTitle>Your data</CardTitle><CardDescription>Export or permanently delete what we hold about you.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm font-medium">Export data</p><p className="text-sm text-muted">Account details and completed analysis results as JSON (no video).</p></div>
          <Button variant="secondary" loading={exp.isPending} onClick={() => exp.mutate()}><Download className="h-4 w-4" aria-hidden />Export</Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <div><p className="text-sm font-medium">Delete all media</p><p className="text-sm text-muted">Removes every stored video and frame image. Results remain.</p></div>
          <Dialog open={openMedia} onOpenChange={setOpenMedia}>
            <Button variant="danger" onClick={() => setOpenMedia(true)}><Trash2 className="h-4 w-4" aria-hidden />Delete all media</Button>
            <DialogContent title="Delete all media?" description="All your stored videos and extracted frames will be permanently deleted. This cannot be undone.">
              <div className="flex justify-end gap-2"><DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose><Button variant="danger" loading={delMedia.isPending} onClick={() => delMedia.mutate()}>Delete all media</Button></div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <div><p className="text-sm font-medium">Delete account</p><p className="text-sm text-muted">Permanently deletes your account, analyses and media.</p></div>
          <Dialog open={openDelAcct} onOpenChange={(o) => { setOpenDelAcct(o); setPw(''); setPwErr(null) }}>
            <Button variant="danger" onClick={() => setOpenDelAcct(true)}>Delete account</Button>
            <DialogContent title="Delete your account?" description="This permanently removes your account and all associated data. Enter your password to confirm.">
              <form onSubmit={(e) => { e.preventDefault(); setPwErr(null); delAcct.mutate() }} className="space-y-4">
                <Field label="Password" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} error={pwErr ?? undefined} />
                <div className="flex justify-end gap-2"><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit" variant="danger" disabled={!pw} loading={delAcct.isPending}>Delete my account</Button></div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}

export default function Settings() {
  const { user } = useAuth()
  if (!user) return null
  return (
    <div>
      <PageHeader title="Settings" description="Profile, privacy and data controls." />
      <div className="space-y-5"><Profile user={user} /><Password /><Data /></div>
    </div>
  )
}
