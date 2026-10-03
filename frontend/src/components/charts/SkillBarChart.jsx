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

/**
 * SkillBarChart — horizontal bars of per-skill class averages. Bars are tinted
 * by score (red < 60 < primary < 80 < green) so weak skills pop.
 *
 * Props:
 *   data: [{ label, score }]
 */
// Vivid, saturated bar colors (independent of the muted UI tokens).
const BAR_HIGH = '#1fd65f' // strong green  (>= 80)
const BAR_MID = '#17b6e6' // vivid cyan    (>= 60)
const BAR_LOW = '#ff3b5c' // hot red/pink  (< 60)

export function SkillBarChart({ data }) {
  const c = useChartColors()
  const colorFor = (score) =>
    score >= 80 ? BAR_HIGH : score >= 60 ? BAR_MID : BAR_LOW

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 46)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 36, bottom: 4, left: 8 }}
        barCategoryGap={10}
      >
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
          cursor={{ fill: c.border, opacity: 0.25 }}
          content={<ChartTooltip suffix="%" />}
        />
        <Bar dataKey="score" name="Average" radius={[6, 6, 6, 6]} barSize={16}>
          {data.map((d) => (
            <Cell key={d.label} fill={colorFor(d.score)} />
          ))}
          <LabelList
            dataKey="score"
            position="right"
            formatter={(v) => `${v}%`}
            style={{ fill: c.text, fontSize: 12, fontWeight: 700 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
