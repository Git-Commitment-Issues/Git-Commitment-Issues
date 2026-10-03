import { useCountUp } from '@/hooks/useCountUp'

/**
 * CountUp — renders a number that counts up from 0 on mount, preserving any
 * surrounding text (e.g. "74%" keeps the %, "+13%" keeps the +).
 *
 * Accepts either a number (`value={74}`) or a string with one number embedded
 * (`value="74%"`). Non-numeric strings render unchanged.
 *
 * Props:
 *   value:    number | string
 *   duration: ms (default 1800 — slow + smooth)
 */
export function CountUp({ value, duration = 1800 }) {
  const str = String(value ?? '')
  const match = str.match(/-?\d+(\.\d+)?/)

  // No number to animate — render as-is.
  if (match == null) return <>{str}</>

  const num = parseFloat(match[0])
  const decimals = match[1] ? match[1].length - 1 : 0
  const prefix = str.slice(0, match.index)
  const suffix = str.slice(match.index + match[0].length)

  return <Counter target={num} decimals={decimals} prefix={prefix} suffix={suffix} duration={duration} />
}

function Counter({ target, decimals, prefix, suffix, duration }) {
  const current = useCountUp(target, { duration, decimals })
  return (
    <>
      {prefix}
      {current.toFixed(decimals)}
      {suffix}
    </>
  )
}
