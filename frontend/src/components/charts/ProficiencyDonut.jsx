import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useChartColors } from './useChartColors'
import { ChartTooltip } from './ChartTooltip'
import './charts.css'

/**
 * ProficiencyDonut — distribution of learners across proficiency bands, with a
 * total in the middle.
 *
 * Props:
 *   data: [{ name, value, tone }]  tone ∈ 'success' | 'primary' | 'error'
 */
// Vivid, saturated segment colors (independent of the muted UI tokens).
const TONE_COLOR = {
  success: '#1fd65f', // strong green
  primary: '#17b6e6', // vivid cyan
  error: '#ff3b5c', // hot red/pink
}

export function ProficiencyDonut({ data }) {
  const c = useChartColors()
  const toneColor = TONE_COLOR
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="donut">
      <div className="donut__chart">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Tooltip content={<ChartTooltip />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={88}
              paddingAngle={3}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.name} fill={toneColor[d.tone] ?? c.primary} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="donut__center">
          <span className="donut__total">{total}</span>
          <span className="donut__total-label">students</span>
        </div>
      </div>

      <ul className="donut__legend">
        {data.map((d) => (
          <li key={d.name} className="donut__legend-item">
            <span
              className="donut__legend-dot"
              style={{ background: toneColor[d.tone] ?? c.primary }}
            />
            <span className="donut__legend-name">{d.name}</span>
            <span className="donut__legend-value">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
