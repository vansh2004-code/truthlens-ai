import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn('flex h-10 w-full rounded-md border bg-bg/60 px-3 text-sm text-fg placeholder:text-muted/70 disabled:opacity-50 aria-[invalid=true]:border-danger', className)}
    {...props}
  />
))
Input.displayName = 'Input'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: ReactNode
}
/** Labelled input with accessible error/hint association. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(({ label, error, hint, id, ...props }, ref) => {
  const auto = useId()
  const fid = id ?? auto
  const describedBy = [error ? `${fid}-err` : null, hint ? `${fid}-hint` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="space-y-1.5">
      <label htmlFor={fid} className="text-sm font-medium">{label}</label>
      <Input id={fid} ref={ref} aria-invalid={!!error} aria-describedby={describedBy} {...props} />
      {hint && <p id={`${fid}-hint`} className="text-xs text-muted">{hint}</p>}
      {error && <p id={`${fid}-err`} role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  )
})
Field.displayName = 'Field'
