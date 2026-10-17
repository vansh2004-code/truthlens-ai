import * as S from '@radix-ui/react-switch'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '@/lib/utils'

export const Switch = forwardRef<ElementRef<typeof S.Root>, ComponentPropsWithoutRef<typeof S.Root>>(({ className, ...p }, ref) => (
  <S.Root ref={ref} className={cn('inline-flex h-6 w-11 shrink-0 items-center rounded-full border bg-elevated transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary disabled:opacity-50', className)} {...p}>
    <S.Thumb className="block h-[18px] w-[18px] translate-x-1 rounded-full bg-fg transition-transform data-[state=checked]:translate-x-[23px]" />
  </S.Root>
))
Switch.displayName = 'Switch'
