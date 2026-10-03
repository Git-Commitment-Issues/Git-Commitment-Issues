import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useChartColors } from './useChartColors'
import { ChartTooltip } from './ChartTooltip'

/**
 * TrendAreaChart — class comprehension average across recent assessments.
 *
 * Props:
 *   data: [{ label, score }]
 */
export function TrendAreaChart({ data }) {
  const c = useChartColors()

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.primary} stopOpacity={0.35} />
            <stop offset="100%" stopColor={c.primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={c.border} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: c.textMuted, fontSize: 12 }}
        />
        <YAxis
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          tick={{ fill: c.textMuted, fontSize: 12 }}
          width={44}
        />
        <Tooltip content={<ChartTooltip suffix="%" />} />
        <Area
          type="monotone"
          dataKey="score"
          name="Class average"
          stroke={c.primary}
          strokeWidth={2.5}
          fill="url(#trendFill)"
          dot={{ r: 3, fill: c.primary, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
