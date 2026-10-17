import { cn } from '@/lib/utils'

export function Progress({ value, label, className, indeterminate }: { value: number; label: string; className?: string; indeterminate?: boolean }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : pct}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-elevated', className)}
    >
      <div
        className={cn('h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-500', indeterminate && 'animate-pulse')}
        style={{ width: indeterminate ? '40%' : `${pct}%` }}
      />
    </div>
  )
}
