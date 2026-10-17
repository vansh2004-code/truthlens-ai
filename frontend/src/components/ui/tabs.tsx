import * as T from '@radix-ui/react-tabs'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import { cn } from '@/lib/utils'

export const Tabs = T.Root
export const TabsList = forwardRef<ElementRef<typeof T.List>, ComponentPropsWithoutRef<typeof T.List>>(({ className, ...p }, ref) => (
  <T.List ref={ref} className={cn('flex gap-1 overflow-x-auto rounded-lg border bg-surface/80 p-1', className)} {...p} />
))
TabsList.displayName = 'TabsList'
export const TabsTrigger = forwardRef<ElementRef<typeof T.Trigger>, ComponentPropsWithoutRef<typeof T.Trigger>>(({ className, ...p }, ref) => (
  <T.Trigger
    ref={ref}
    className={cn('whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm font-medium text-muted transition-colors hover:text-fg data-[state=active]:bg-elevated data-[state=active]:text-fg data-[state=active]:shadow', className)}
    {...p}
  />
))
TabsTrigger.displayName = 'TabsTrigger'
export const TabsContent = forwardRef<ElementRef<typeof T.Content>, ComponentPropsWithoutRef<typeof T.Content>>(({ className, ...p }, ref) => (
  <T.Content ref={ref} className={cn('mt-5', className)} {...p} />
))
TabsContent.displayName = 'TabsContent'
