import { CheckCircle2, Info, XCircle, X } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Kind = 'success' | 'error' | 'info'
interface T { id: number; kind: Kind; message: string }
const Ctx = createContext<(kind: Kind, message: string) => void>(() => undefined)
let seq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([])
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), [])
  const push = useCallback((kind: Kind, message: string) => {
    const id = ++seq
    setItems((l) => [...l.slice(-3), { id, kind, message }])
    setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 4500)
  }, [dismiss])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-20 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 md:bottom-4" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className={cn('pointer-events-auto flex items-start gap-2.5 rounded-md border bg-elevated p-3 text-sm shadow-xl', t.kind === 'error' && 'border-danger/50', t.kind === 'success' && 'border-ok/50')}>
            {t.kind === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden /> : t.kind === 'error' ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />}
            <p className="flex-1">{t.message}</p>
            <button aria-label="Dismiss notification" onClick={() => dismiss(t.id)} className="rounded p-0.5 text-muted hover:text-fg"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const push = useContext(Ctx)
  return useMemo(() => ({ success: (m: string) => push('success', m), error: (m: string) => push('error', m), info: (m: string) => push('info', m) }), [push])
}
