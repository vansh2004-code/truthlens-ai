import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="font-mono text-sm text-primary">404</p>
      <h1 className="text-4xl font-semibold tracking-tight">Page not found</h1>
      <p className="max-w-md text-muted">The page you are looking for does not exist or may have moved.</p>
      <Button asChild variant="primary"><Link to="/">Back to home</Link></Button>
    </div>
  )
}
