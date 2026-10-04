import { useTranslation } from "react-i18next"
import { Badge } from "./Badge"
import { statusInfo } from "@/domain/constants"

/**
 * StatusBadge — assessment status pill (scheduled | in_progress | completed).
 * Thin wrapper over Badge using the shared domain status taxonomy so status
 * reads the same everywhere. The label is localized; the English taxonomy
 * label is the fallback for any unknown key.
 *
 * Props:
 *   status: backend status key
 */
export function StatusBadge({ status, ...props }) {
  const { t } = useTranslation()
  const info = statusInfo(status)
  return (
    <Badge tone={info.tone} dot {...props}>
      {t(`status.${status}`, info.label)}
    </Badge>
  )
}