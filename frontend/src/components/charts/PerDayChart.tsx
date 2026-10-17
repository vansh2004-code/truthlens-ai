import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MyStats } from '@/lib/types'
import { CHART, ChartFrame, tooltipStyle } from './ChartFrame'

/** Fills calendar gaps with explicit zeros (days with no analyses) so the x-axis is continuous. */
export function fillDays(perDay: MyStats['per_day'], days = 30, today = new Date()): { date: string; count: number }[] {
  const map = new Map(perDay.map((d) => [d.date, d.count]))
  const out: { date: string; count: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i))
    const key = d.toISOString().slice(0, 10)
    out.push({ date: key, count: map.get(key) ?? 0 })
  }
  return out
}

export function PerDayChart({ perDay }: { perDay: MyStats['per_day'] }) {
  const data = fillDays(perDay)
  const total = data.reduce((a, b) => a + b.count, 0)
  return (
    <ChartFrame
      title="Analyses per day"
      description={`Your analyses over the last 30 days (${total} total).`}
      srTable={<table><caption>Analyses per day, last 30 days</caption><thead><tr><th>Date</th><th>Count</th></tr></thead><tbody>{data.filter((d) => d.count > 0).map((d) => <tr key={d.date}><td>{d.date}</td><td>{d.count}</td></tr>)}</tbody></table>}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="pd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={CHART.primary} stopOpacity={0.45} /><stop offset="1" stopColor={CHART.primary} stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="date" tick={{ fill: CHART.axis, fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} interval={4} stroke={CHART.grid} />
          <YAxis allowDecimals={false} tick={{ fill: CHART.axis, fontSize: 11 }} stroke={CHART.grid} />
          <Tooltip {...tooltipStyle} formatter={(v) => [v as number, 'Analyses']} />
          <Area type="monotone" dataKey="count" stroke={CHART.primary} strokeWidth={2} fill="url(#pd)" dot={{ r: 2.5, fill: CHART.primary }} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}
