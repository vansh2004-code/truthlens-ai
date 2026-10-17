import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', {
  variants: {
    tone: {
      neutral: 'bg-elevated text-muted',
      info: 'border-primary/40 bg-primary/10 text-primary',
      danger: 'border-danger/40 bg-danger/10 text-danger',
      warn: 'border-warn/40 bg-warn/10 text-warn',
      ok: 'border-ok/40 bg-ok/10 text-ok',
      accent: 'border-accent/40 bg-accent/10 text-accent',
    },
  },
  defaultVariants: { tone: 'neutral' },
})
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
export const Badge = ({ className, tone, ...p }: BadgeProps) => <span className={cn(badgeVariants({ tone }), className)} {...p} />
