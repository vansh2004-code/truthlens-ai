import * as S from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface Option { value: string; label: string }
const ALL = '__all__'

/** Radix Select can't hold an empty-string item, so '' is mapped to a sentinel internally. */
export function Select({ value, onValueChange, options, label, className, id }: { value: string; onValueChange: (v: string) => void; options: Option[]; label: string; className?: string; id?: string }) {
  return (
    <S.Root value={value === '' ? ALL : value} onValueChange={(v) => onValueChange(v === ALL ? '' : v)}>
      <S.Trigger id={id} aria-label={label} className={cn('flex h-10 min-w-[9rem] items-center justify-between gap-2 rounded-md border bg-bg/60 px-3 text-sm', className)}>
        <S.Value />
        <S.Icon><ChevronDown className="h-4 w-4 text-muted" aria-hidden /></S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content position="popper" sideOffset={4} className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border bg-elevated shadow-xl">
          <S.Viewport className="p-1">
            {options.map((o) => (
              <S.Item key={o.value} value={o.value === '' ? ALL : o.value} className="relative flex cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-3 text-sm outline-none data-[highlighted]:bg-primary/20">
                <S.ItemIndicator className="absolute left-2"><Check className="h-4 w-4" aria-hidden /></S.ItemIndicator>
                <S.ItemText>{o.label}</S.ItemText>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  )
}
export type { ReactNode }
