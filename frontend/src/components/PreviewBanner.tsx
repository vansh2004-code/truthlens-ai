import { Info } from 'lucide-react'

/** Shown only in the static GitHub Pages build (VITE_PAGES_PREVIEW=true). Real deployments never render it. */
export function PreviewBanner() {
  if (import.meta.env.VITE_PAGES_PREVIEW !== 'true') return null
  return (
    <div role="status" className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        <strong>Static preview.</strong> This GitHub Pages site hosts the interface only. The analysis backend and detection model are not
        deployed here, so sign-in and video analysis are unavailable. Source and setup:{' '}
        <a className="underline" href="https://github.com/vansh2004-code/truthlens-ai" rel="noreferrer">github.com/vansh2004-code/truthlens-ai</a>.
      </p>
    </div>
  )
}
