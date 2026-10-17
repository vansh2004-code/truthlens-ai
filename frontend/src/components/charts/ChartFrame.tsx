import type { ReactNode } from 'react'

/** Accessible figure wrapper: title, description and a screen-reader data summary. */
export function ChartFrame({ title, description, children, srTable, height = 260 }: { title: string; description: string; children: ReactNode; srTable?: ReactNode; height?: number }) {
  return (
    <figure className="m-0" role="group" aria-label={title}>
      <figcaption className="mb-3">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted">{description}</span>
      </figcaption>
      <div style={{ height }} aria-hidden={srTable ? true : undefined}>{children}</div>
      {srTable && <div className="sr-only">{srTable}</div>}
    </figure>
  )
}

export const CHART = {
  grid: 'hsl(223 22% 20%)',
  axis: 'hsl(218 14% 66%)',
  primary: 'hsl(221 91% 62%)',
  accent: 'hsl(262 83% 68%)',
  danger: 'hsl(0 84% 68%)',
  warn: 'hsl(38 92% 58%)',
  neutral: 'hsl(218 14% 55%)',
}

export const tooltipStyle = {
  contentStyle: { background: 'hsl(223 31% 13%)', border: '1px solid hsl(223 22% 24%)', borderRadius: 8, fontSize: 12, color: 'hsl(220 25% 96%)' },
  labelStyle: { color: 'hsl(220 25% 96%)' },
  itemStyle: { color: 'hsl(220 25% 96%)' },
}
