import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useChartColors } from './useChartColors'
import { ChartTooltip } from './ChartTooltip'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * SkillBarChart — horizontal bars of per-skill class averages, styled as neon:
 * a bright outline with a soft glow and a subtle translucent fill of the same
 * color. Color-coded by score (green ≥80, cyan ≥60, red <60). Bars grow in
 * from the left on mount.
 *
 * Props:
 *   data: [{ label, score }]
 */

// Neon color per band. `line` paints the outline + glow; `fill` is the subtle
// interior wash (low opacity of the same hue).
const BANDS = {
  high: { line: '#2fe06f', fill: 'rgba(47, 224, 111, 0.14)' }, // green
  mid: { line: '#2bd4f5', fill: 'rgba(43, 212, 245, 0.14)' }, // cyan
  low: { line: '#ff5277', fill: 'rgba(255, 82, 119, 0.14)' }, // red/pink
}

const bandFor = (score) => (score >= 80 ? 'high' : score >= 60 ? 'mid' : 'low')

export function SkillBarChart({ data }) {
  const c = useChartColors()
  const animate = !prefersReducedMotion()

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 46)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 48, bottom: 4, left: 8 }}
        barCategoryGap={10}
      >
        <defs>
          {/* Soft outer glow for the neon outline. */}
          {Object.entries(BANDS).map(([key, b]) => (
            <filter
              key={key}
              id={`barGlow-${key}`}
              x="-20%"
              y="-60%"
              width="124%"
              height="220%"
            >
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="3"
                floodColor={b.line}
                floodOpacity="0.7"
              />
            </filter>
          ))}
        </defs>
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          type="category"
          dataKey="label"
          width={120}
          tickLine={false}
          axisLine={false}
          tick={{ fill: c.textMuted, fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: c.border, opacity: 0.2 }}
          content={<ChartTooltip suffix="%" />}
        />
        <Bar
          dataKey="score"
          name="Average"
          radius={[7, 7, 7, 7]}
          barSize={16}
          isAnimationActive={animate}
          animationBegin={120}
          animationDuration={900}
          animationEasing="ease-out"
        >
          {data.map((d) => {
            const b = BANDS[bandFor(d.score)]
            return (
              <Cell
                key={d.label}
                fill={b.fill}
                stroke={b.line}
                strokeWidth={1}
                strokeOpacity={0.65}
                filter={`url(#barGlow-${bandFor(d.score)})`}
              />
            )
          })}
          <LabelList
            dataKey="score"
            position="right"
            formatter={(v) => `${v}%`}
            style={{ fill: c.textSecondary, fontSize: 13, fontWeight: 700 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
