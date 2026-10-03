import { Badge } from "./Badge"
import { VERDICT } from "@/domain/constants"

/**
 * VerdictBadge — AI/teacher verdict pill (correct | partial | missed).
 * Thin wrapper over Badge using the shared domain verdict taxonomy.
 *
 * Props:
 *   verdict: backend verdict key
 */
export function VerdictBadge({ verdict, ...props }) {
  const info = VERDICT[verdict]
  if (!info) return null
  return (
    <Badge tone={info.tone} {...props}>
      {info.label}
    </Badge>
  )
}