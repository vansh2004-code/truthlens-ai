import * as T from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'

export const TooltipProvider = T.Provider
export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <T.Root delayDuration={200}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content sideOffset={6} className="z-50 max-w-xs rounded-md border bg-elevated px-3 py-2 text-xs leading-5 text-fg shadow-lg">
          {content}
          <T.Arrow className="fill-elevated" />
        </T.Content>
      </T.Portal>
    </T.Root>
  )
}
