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
            <stop offset="0%" stopColor="#2bd4f5" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#2bd4f5" stopOpacity={0} />
          </linearGradient>
          {/* Soft neon glow for the line. */}
          <filter id="trendGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="4"
              floodColor="#2bd4f5"
              floodOpacity="0.65"
            />
          </filter>
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
          stroke="#2bd4f5"
          strokeWidth={2}
          fill="url(#trendFill)"
          filter="url(#trendGlow)"
          dot={{ r: 3, fill: '#2bd4f5', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
