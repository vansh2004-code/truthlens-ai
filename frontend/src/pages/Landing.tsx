import { motion } from 'framer-motion'
import { Activity, AudioLines, EyeOff, FileText, Film, Layers, Lock, ScanFace, ShieldCheck, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/lib/auth'
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_MB } from '@/lib/constants'

const STEPS = [
  { icon: Film, title: 'Upload', text: `Send a video (${ALLOWED_EXTENSIONS.join(', ')}; up to ${MAX_UPLOAD_MB} MB). The server verifies the file is a genuine video before processing.` },
  { icon: ScanFace, title: 'Detect faces', text: 'Frames are sampled over time, faces are detected and tracked, and low-quality frames are set aside rather than scored.' },
  { icon: Activity, title: 'Score and review', text: 'A classifier scores each usable face frame. You see per-frame scores, a timeline, evidence frames and a plain-language explanation.' },
]
const CAPS = [
  { icon: Layers, title: 'Frame-by-frame viewer', text: 'Step through sampled frames with face boxes, quality metrics and per-frame notes.' },
  { icon: Activity, title: 'Temporal analysis', text: 'See how model scores vary over time, with suspicious intervals and abrupt score changes highlighted.' },
  { icon: ShieldCheck, title: 'Evidence frames', text: 'Review the highest-scoring frames with saliency overlays, clearly labelled as indicative rather than proof.' },
  { icon: FileText, title: 'Reports', text: 'Download PDF or JSON reports, or share an expiring link.' },
  { icon: AudioLines, title: 'Audio, when configured', text: 'Audio analysis runs only if the deployment enables it; otherwise it is reported as not performed, with the reason.' },
  { icon: Lock, title: 'Account security', text: 'HttpOnly cookie sessions, CSRF protection, rate limits and optional email verification.' },
]

export default function Landing() {
  const { user } = useAuth()
  return (
    <div>
      <section className="container pb-20 pt-20 text-center sm:pt-28">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mx-auto max-w-3xl">
          <p className="mb-4 inline-flex rounded-full border bg-surface/70 px-3 py-1 text-xs text-muted">Media forensics decision support</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">Examine video with <span className="text-gradient">transparent evidence</span></h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">TruthLens AI analyzes faces in video and shows you exactly what the model saw: per-frame scores, timelines, quality notes and clear limitations. It supports human judgement; it does not replace it.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild variant="primary" size="lg"><Link to={user ? '/analyze' : '/register'}>{user ? 'Analyze a video' : 'Get started'}</Link></Button>
            <Button asChild variant="outline" size="lg"><Link to="/docs">Read the documentation</Link></Button>
          </div>
        </motion.div>
      </section>

      <section className="container py-12" aria-labelledby="how">
        <h2 id="how" className="text-center text-3xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.li key={s.title} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
              <Card className="h-full"><CardContent className="space-y-3 p-6">
                <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary"><s.icon className="h-5 w-5" aria-hidden /></span><h3 className="font-semibold"><span className="mr-1.5 font-mono text-muted">{i + 1}.</span>{s.title}</h3></div>
                <p className="text-sm leading-6 text-muted">{s.text}</p>
              </CardContent></Card>
            </motion.li>
          ))}
        </ol>
      </section>

      <section className="container py-12" aria-labelledby="caps">
        <h2 id="caps" className="text-center text-3xl font-semibold tracking-tight">Capabilities</h2>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CAPS.map((c) => (
            <li key={c.title}><Card className="h-full"><CardContent className="space-y-2 p-6"><c.icon className="h-5 w-5 text-accent" aria-hidden /><h3 className="font-semibold">{c.title}</h3><p className="text-sm leading-6 text-muted">{c.text}</p></CardContent></Card></li>
          ))}
        </ul>
      </section>

      <section className="container py-12" aria-labelledby="limits">
        <div className="mx-auto max-w-3xl rounded-xl border border-warn/30 bg-warn/5 p-8">
          <h2 id="limits" className="text-2xl font-semibold tracking-tight">What this tool cannot tell you</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
            <li>Scores are <strong className="text-fg">uncalibrated model outputs</strong>, not probabilities. A score of 0.80 does not mean "80% likely fake".</li>
            <li>"No strong manipulation indicators detected" does <strong className="text-fg">not</strong> establish that a video is unaltered. New generation methods can evade any detector.</li>
            <li>Compression, low light, motion, occlusion and small faces can raise or lower scores independent of manipulation.</li>
            <li>Only faces are analyzed. Fully synthetic scenes without faces, or edits outside the face region, may not be detected.</li>
            <li>Results should be reviewed by a person and combined with provenance and context before any decision is made.</li>
          </ul>
        </div>
      </section>

      <section className="container py-12" aria-labelledby="priv">
        <h2 id="priv" className="text-center text-3xl font-semibold tracking-tight">Privacy by default</h2>
        <ul className="mx-auto mt-8 grid max-w-4xl gap-5 sm:grid-cols-3">
          <li className="rounded-lg border bg-surface/70 p-5"><EyeOff className="mb-2 h-5 w-5 text-primary" aria-hidden /><h3 className="font-semibold">No training on uploads</h3><p className="mt-1 text-sm text-muted">Your media is not used to improve models unless you opt in, and the opt-in is off by default.</p></li>
          <li className="rounded-lg border bg-surface/70 p-5"><Trash2 className="mb-2 h-5 w-5 text-primary" aria-hidden /><h3 className="font-semibold">You control retention</h3><p className="mt-1 text-sm text-muted">Set an automatic deletion period, or delete a video, an analysis or your whole account at any time.</p></li>
          <li className="rounded-lg border bg-surface/70 p-5"><Lock className="mb-2 h-5 w-5 text-primary" aria-hidden /><h3 className="font-semibold">No third parties by default</h3><p className="mt-1 text-sm text-muted">Analysis runs on the deployment's own servers. Read the full <Link to="/privacy" className="text-primary underline underline-offset-4">privacy notice</Link>.</p></li>
        </ul>
      </section>

      <section className="container py-16 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">Ready to examine a video?</h2>
        <div className="mt-6"><Button asChild variant="primary" size="lg"><Link to={user ? '/analyze' : '/register'}>{user ? 'Go to analyzer' : 'Create a free account'}</Link></Button></div>
      </section>
    </div>
  )
}
