import { FileVideo, UploadCloud, X } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/toast'
import { errorMessage } from '@/lib/api'
import { ALLOWED_EXTENSIONS, MAX_DURATION_SECONDS, MAX_UPLOAD_MB } from '@/lib/constants'
import { useUpload } from '@/lib/queries'
import { cn, formatBytes } from '@/lib/utils'
import { validateUpload } from '@/lib/validation'

export default function Analyze() {
  const nav = useNavigate()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const abort = useRef<AbortController | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const [progress, setProgress] = useState(0)
  const upload = useUpload()

  const pick = (f: File | undefined) => {
    if (!f) return
    const problem = validateUpload(f)
    setError(problem)
    setFile(problem ? null : f)
    setProgress(0)
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDrag(false)
    pick(e.dataTransfer.files[0])
  }
  const start = () => {
    if (!file) return
    setError(null)
    abort.current = new AbortController()
    upload.mutate(
      { file, onProgress: setProgress, signal: abort.current.signal },
      {
        onSuccess: (a) => {
          toast.success('Upload complete. Analysis queued.')
          nav(`/analyses/${a.id}`)
        },
        onError: (e) => {
          if (e instanceof DOMException && e.name === 'AbortError') return
          setError(errorMessage(e))
        },
      },
    )
  }
  const uploading = upload.isPending

  return (
    <div>
      <PageHeader title="Analyze a video" description="Upload a video containing faces. The model scores sampled face frames; results are decision support, not proof." />
      <Card>
        <CardContent className="p-5 sm:p-6">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            className={cn('flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-14 text-center transition-colors', drag ? 'border-primary bg-primary/5' : 'border-border')}
          >
            <UploadCloud className="h-10 w-10 text-primary" aria-hidden />
            <p className="font-medium">Drag and drop a video here</p>
            <p className="text-sm text-muted">or</p>
            <Button variant="secondary" onClick={() => input.current?.click()} disabled={uploading}>Choose file</Button>
            <input ref={input} type="file" className="sr-only" aria-label="Choose video file" accept={ALLOWED_EXTENSIONS.join(',')} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
            <p className="text-xs text-muted">Accepted: {ALLOWED_EXTENSIONS.join(' ')} · up to {MAX_UPLOAD_MB} MB · up to about {Math.round(MAX_DURATION_SECONDS / 60)} minutes</p>
          </div>

          {error && <div role="alert" className="mt-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}

          {file && (
            <div className="mt-5 space-y-4 rounded-lg border bg-bg/40 p-4">
              <div className="flex items-center gap-3">
                <FileVideo className="h-6 w-6 text-primary" aria-hidden />
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{file.name}</p><p className="text-xs text-muted">{formatBytes(file.size)}</p></div>
                {!uploading && <button aria-label="Remove selected file" className="rounded p-1.5 text-muted hover:bg-elevated hover:text-fg" onClick={() => { setFile(null); setProgress(0) }}><X className="h-4 w-4" /></button>}
              </div>
              {uploading && (
                <div className="space-y-1.5">
                  <Progress value={progress} label="Upload progress" />
                  <p className="text-xs text-muted" aria-live="polite">{progress >= 1 ? 'Upload finished. Validating on the server…' : `Uploading… ${Math.round(progress * 100)}%`}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="primary" onClick={start} loading={uploading}>{uploading ? 'Uploading' : 'Start analysis'}</Button>
                {uploading && <Button variant="ghost" onClick={() => abort.current?.abort()}>Cancel upload</Button>}
              </div>
            </div>
          )}
          <p className="mt-5 text-xs text-muted">Client-side checks only catch obvious problems. The server independently verifies file signatures and media validity. You can have up to 3 analyses in progress at once.</p>
        </CardContent>
      </Card>
    </div>
  )
}
