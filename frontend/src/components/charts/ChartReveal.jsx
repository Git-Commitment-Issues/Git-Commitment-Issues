import { useInView } from '@/hooks/useInView'

/**
 * ChartReveal — defers rendering its chart until it scrolls into view, so the
 * chart's enter animation plays on reveal instead of firing (invisibly) on
 * page load. Reserves height up front to avoid layout shift.
 *
 * Usage:
 *   <ChartReveal height={240}>
 *     <SomeChart data={data} />
 *   </ChartReveal>
 */
export function ChartReveal({ children, height = 220 }) {
  const [ref, inView] = useInView()
  return (
    <div ref={ref} style={{ minHeight: height }}>
      {inView ? children : null}
    </div>
  )
}
