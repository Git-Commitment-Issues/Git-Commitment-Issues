import { Badge } from "./Badge"
import { statusInfo } from "@/domain/constants"

/**
 * StatusBadge — assessment status pill (scheduled | in_progress | completed).
 * Thin wrapper over Badge using the shared domain status taxonomy so status
 * reads the same everywhere. No bespoke styling.
 *
 * Props:
 *   status: backend status key
 */
export function StatusBadge({ status, ...props }) {
  const info = statusInfo(status)
  return (
    <Badge tone={info.tone} dot {...props}>
      {info.label}
    </Badge>
  )
}