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
      {payload.map((entry) => {
        // Bars/segments fill with an SVG gradient (url(#…)), which can't paint
        // an HTML dot — fall back to the brand primary in that case.
        const raw = entry.color ?? entry.payload?.fill
        const dot =
          typeof raw === 'string' && raw.startsWith('url(')
            ? 'var(--color-primary)'
            : raw
        return (
          <p key={entry.name} className="chart-tip__row">
            <span className="chart-tip__dot" style={{ background: dot }} />
            <span className="chart-tip__name">{entry.name}</span>
            <span className="chart-tip__value">
              {entry.value}
              {suffix}
            </span>
          </p>
        )
      })}
    </div>
  )
}
