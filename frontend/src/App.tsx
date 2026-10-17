import { MotionConfig } from 'framer-motion'
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ToastProvider } from '@/components/ui/toast'
import { AuthProvider } from '@/lib/auth'
import { AppRoutes } from './routes'

export default function App() {
  const navigate = useNavigate()
  const onAuthFailure = useCallback(
    (returnTo: string) => {
      if (window.location.pathname === '/login') return
      navigate(`/login?next=${encodeURIComponent(returnTo)}`, { replace: true })
    },
    [navigate],
  )
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        <ToastProvider>
          <AuthProvider onAuthFailure={onAuthFailure}>
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-fg">Skip to main content</a>
            <AppRoutes />
          </AuthProvider>
        </ToastProvider>
      </TooltipProvider>
    </MotionConfig>
  )
}
