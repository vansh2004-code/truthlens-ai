import { ImageOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { frameImageUrl } from '@/lib/queries'
import type { Frame } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Cookie-authenticated <img>; shows a placeholder if the image is gone (404 / retention). */
export function FrameImage({ analysisId, frame, kind = 'image', className, alt }: { analysisId: string; frame: Frame; kind?: 'image' | 'overlay'; className?: string; alt?: string }) {
  const available = kind === 'image' ? frame.has_image : frame.has_overlay
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [frame.id, kind])
  if (!available || failed) {
    return (
      <div role="img" aria-label="Frame image unavailable" className={cn('flex flex-col items-center justify-center gap-1 bg-elevated text-xs text-muted', className)}>
        <ImageOff className="h-5 w-5" aria-hidden />{available ? 'Not available' : 'No image'}
      </div>
    )
  }
  return <img src={frameImageUrl(analysisId, frame.id, kind)} alt={alt ?? `Frame at ${frame.timestamp.toFixed(1)} seconds`} loading="lazy" onError={() => setFailed(true)} className={cn('object-cover', className)} />
}
