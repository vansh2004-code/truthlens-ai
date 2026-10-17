import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Verdict } from '@/lib/types'
import { VERDICT_LABEL } from '@/lib/verdict'
import { CHART, ChartFrame, tooltipStyle } from './ChartFrame'

const ORDER: Verdict[] = ['potential_manipulation', 'inconclusive', 'no_strong_indicators', 'failed']
const COLOR: Record<Verdict, string> = { potential_manipulation: CHART.danger, inconclusive: CHART.warn, no_strong_indicators: CHART.primary, failed: CHART.neutral }
const SHORT: Record<Verdict, string> = { potential_manipulation: 'Potential manipulation', inconclusive: 'Inconclusive', no_strong_indicators: 'No strong indicators', failed: 'Failed' }

export function VerdictChart({ verdicts }: { verdicts: Record<string, number> }) {
  const data = ORDER.map((v) => ({ key: v, name: SHORT[v], count: verdicts[v] ?? 0 }))
  return (
    <ChartFrame
      title="Outcome distribution"
      description="Completed analyses by outcome. Outcomes are labelled directly, not only by colour."
      srTable={<table><caption>Completed analyses by outcome</caption><thead><tr><th>Outcome</th><th>Count</th></tr></thead><tbody>{data.map((d) => <tr key={d.key}><td>{VERDICT_LABEL[d.key]}</td><td>{d.count}</td></tr>)}</tbody></table>}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: CHART.axis, fontSize: 11 }} stroke={CHART.grid} />
          <YAxis type="category" dataKey="name" width={130} tick={{ fill: CHART.axis, fontSize: 12 }} stroke={CHART.grid} />
          <Tooltip {...tooltipStyle} cursor={{ fill: 'hsl(223 31% 13% / 0.6)' }} formatter={(v) => [v as number, 'Analyses']} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {data.map((d) => <Cell key={d.key} fill={COLOR[d.key]} />)}
            <LabelList dataKey="count" position="right" fill={CHART.axis} fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}
