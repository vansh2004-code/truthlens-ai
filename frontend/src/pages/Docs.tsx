import { Link } from 'react-router-dom'
import { ALLOWED_EXTENSIONS, DEFAULT_INCONCLUSIVE_LOW, DEFAULT_THRESHOLD, MAX_ACTIVE_JOBS, MAX_DURATION_SECONDS, MAX_UPLOAD_MB } from '@/lib/constants'
import { VERDICT_HELP, VERDICT_LABEL } from '@/lib/verdict'
import type { Verdict } from '@/lib/types'

export default function Docs() {
  return (
    <article className="container prose-tl max-w-3xl py-14">
      <h1 className="text-4xl font-semibold tracking-tight">Documentation</h1>
      <p className="mt-3">How TruthLens AI analyzes video, what the outcomes mean, and what it cannot do.</p>

      <h2>How analysis works</h2>
      <ul>
        <li><strong>Validation.</strong> The server checks the extension, the file signature and that the file is a decodable video within the size and duration limits.</li>
        <li><strong>Frame sampling.</strong> Frames are sampled at a fixed interval (about one per second by default, up to a maximum number of frames).</li>
        <li><strong>Face detection and tracking.</strong> Faces are detected, cropped with a margin and tracked. Frames without a usable face, or with very low quality (blur, darkness, overexposure, tiny faces), are not scored.</li>
        <li><strong>Model scoring.</strong> A pretrained image classifier scores each usable face crop. The score is the model's output for its manipulated class, between 0 and 1.</li>
        <li><strong>Temporal analysis.</strong> Scores are summarized over time: mean, median, spread, runs of frames above the review threshold and large frame-to-frame changes.</li>
        <li><strong>Evidence.</strong> Highest-scoring frames get saliency overlays showing which regions influenced the output.</li>
      </ul>

      <h2>Understanding the score</h2>
      <p>The <strong>model score (uncalibrated)</strong> is not a probability and not a percentage of "fakeness". Scores from different models, or different versions of one model, are not comparable. By default, a frame is above the review threshold at {DEFAULT_THRESHOLD.toFixed(2)}; the exact threshold used is shown with each analysis.</p>

      <h2>Outcomes</h2>
      <ul>
        {(Object.keys(VERDICT_LABEL) as Verdict[]).map((v) => <li key={v}><strong>{VERDICT_LABEL[v]}.</strong> {VERDICT_HELP[v]}</li>)}
      </ul>
      <p>A score below the lower inconclusive bound (default {DEFAULT_INCONCLUSIVE_LOW.toFixed(2)}) leads to "No strong manipulation indicators detected"; that wording is deliberate and never means the media is verified as unaltered.</p>

      <h2>Limitations</h2>
      <ul>
        <li>Detectors can be wrong in both directions and can be evaded by new generation techniques.</li>
        <li>Compression, resolution, lighting, motion and occlusion influence scores.</li>
        <li>Only face regions are analyzed. Voice cloning, audio edits and non-face manipulation are not covered.</li>
        <li>Saliency overlays are indicative, not proof.</li>
        <li><strong>Audio:</strong> audio analysis runs only if enabled on the deployment. Otherwise it is shown as "Not performed" with a reason. Audio-visual synchronization analysis is not implemented.</li>
        <li>Results are decision support. Combine them with provenance, source verification and expert review.</li>
      </ul>

      <h2>Supported formats and limits</h2>
      <ul>
        <li>File types: {ALLOWED_EXTENSIONS.join(', ')}</li>
        <li>Maximum size: {MAX_UPLOAD_MB} MB (deployment default)</li>
        <li>Maximum duration: about {MAX_DURATION_SECONDS / 60} minutes (deployment default)</li>
        <li>Up to {MAX_ACTIVE_JOBS} analyses in progress per account; uploads are rate limited.</li>
        <li>Limits are configured by the deployment's administrator and may differ.</li>
      </ul>

      <h2>Reports and sharing</h2>
      <p>Completed analyses can be exported as PDF or JSON. An expiring link lets someone without an account open a report until the link expires; treat it like a password.</p>

      <p className="mt-10">See also the <Link to="/privacy">privacy notice</Link>.</p>
    </article>
  )
}
