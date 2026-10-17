import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
export const Skeleton = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div aria-hidden className={cn('skeleton', className)} {...p} />
