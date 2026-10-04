import { useTranslation } from "react-i18next"
import { Badge } from "./Badge"
import { VERDICT } from "@/domain/constants"

/**
 * VerdictBadge — AI/teacher verdict pill (correct | partial | missed).
 * Thin wrapper over Badge using the shared domain verdict taxonomy. The label
 * is localized, falling back to the English taxonomy label.
 *
 * Props:
 *   verdict: backend verdict key
 */
export function VerdictBadge({ verdict, ...props }) {
  const { t } = useTranslation()
  const info = VERDICT[verdict]
  if (!info) return null
  return (
    <Badge tone={info.tone} {...props}>
      {t(`verdict.${verdict}`, info.label)}
    </Badge>
  )
}