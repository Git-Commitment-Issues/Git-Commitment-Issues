import './charts.css'

/**
 * ChartTooltip — a themed tooltip shared by the Recharts graphs. Recharts
 * passes `active`, `payload`, and `label` when hovering a data point.
 *
 * Props:
 *   suffix: appended to each value (e.g. '%')
 */
export function ChartTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tip">
      {label ? <p className="chart-tip__label">{label}</p> : null}
      {payload.map((entry) => (
        <p key={entry.name} className="chart-tip__row">
          <span
            className="chart-tip__dot"
            style={{ background: entry.color ?? entry.payload?.fill }}
          />
          <span className="chart-tip__name">{entry.name}</span>
          <span className="chart-tip__value">
            {entry.value}
            {suffix}
          </span>
        </p>
      ))}
    </div>
  )
}
