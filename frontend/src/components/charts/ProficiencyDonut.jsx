import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { ChartTooltip } from './ChartTooltip'
import './charts.css'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * ProficiencyDonut — distribution of learners across proficiency bands, styled
 * as neon: each segment has a bright outline + soft glow and a subtle
 * translucent fill of the same tone. The ring sweeps in on mount; the total
 * sits in the middle.
 *
 * Props:
 *   data: [{ name, value, tone }]  tone ∈ 'success' | 'primary' | 'error'
 */

// Neon color per tone: bright outline/glow + subtle interior fill.
const TONES = {
  success: { line: '#20e468', fill: 'rgba(47, 224, 111, 0.26)' },
  primary: { line: '#0fcbf1', fill: 'rgba(43, 212, 245, 0.26)' },
  error: { line: '#f21646', fill: 'rgba(255, 82, 119, 0.26)' },
}

const toneOf = (tone) => TONES[tone] ?? TONES.primary

export function ProficiencyDonut({ data }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const animate = !prefersReducedMotion()

  return (
    <div className="donut">
      <div className="donut__chart">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <defs>
              {Object.entries(TONES).map(([key, t]) => (
                <filter
                  key={key}
                  id={`donutGlow-${key}`}
                  x="-40%"
                  y="-40%"
                  width="180%"
                  height="180%"
                >
                  <feDropShadow
                    dx="0"
                    dy="0"
                    stdDeviation="3.5"
                    floodColor={t.line}
                    floodOpacity="0.75"
                  />
                </filter>
              ))}
            </defs>
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
              isAnimationActive={animate}
              animationBegin={150}
              animationDuration={1000}
              animationEasing="ease-out"
            >
              {data.map((d) => {
                const t = toneOf(d.tone)
                const key = d.tone in TONES ? d.tone : 'primary'
                return (
                  <Cell
                    key={d.name}
                    fill={t.fill}
                    stroke={t.line}
                    strokeWidth={1}
                    strokeOpacity={0.65}
                    filter={`url(#donutGlow-${key})`}
                  />
                )
              })}
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
              style={{
                backgroundColor: toneOf(d.tone).fill,
                border: `1.5px solid ${toneOf(d.tone).line}`,
                boxShadow: `0 0 6px ${toneOf(d.tone).line}`,
              }}
            />
            <span className="donut__legend-name">{d.name}</span>
            <span className="donut__legend-value">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
