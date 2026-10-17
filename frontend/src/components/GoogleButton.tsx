import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { API_BASE } from '@/lib/constants'

const START = `${API_BASE}/api/auth/google/start`

/** Probes the start endpoint once; hides the button when the server reports Google sign-in is not configured. */
export function GoogleButton({ label }: { label: string }) {
  const probe = useQuery({
    queryKey: ['google-oauth-available'],
    queryFn: async () => {
      try {
        const res = await fetch(START, { redirect: 'manual', credentials: 'include' })
        return res.status !== 501 && res.status < 500
      } catch {
        return false
      }
    },
    staleTime: Infinity,
    retry: false,
  })
  if (!probe.data) return null
  return (
    <>
      <Button type="button" variant="outline" className="w-full" onClick={() => window.location.assign(START)}>
        <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.1z" /><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.9 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" /></svg>
        {label}
      </Button>
      <div className="relative my-1 text-center text-xs text-muted"><span className="relative z-10 bg-surface px-2">or</span><div className="absolute inset-x-0 top-1/2 border-t" /></div>
    </>
  )
}
