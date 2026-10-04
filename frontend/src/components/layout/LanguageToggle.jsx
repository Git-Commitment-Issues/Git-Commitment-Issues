import { Languages } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useLanguage } from "@/i18n/useLanguage"
import "./LanguageToggle.css"

/**
 * LanguageToggle — flips the UI language between English and Filipino.
 * Mirrors ThemeToggle's ergonomics but shows the ACTIVE language's short code
 * (EN / FIL) next to the glyph, and announces the language it would switch TO
 * in its accessible label.
 */
export function LanguageToggle() {
  const { t } = useTranslation()
  const { language, toggleLanguage } = useLanguage()

  const isFilipino = language === "fil"
  const activeShort = isFilipino ? "FIL" : "EN"
  const targetLabel = t("language.switchTo", {
    language: isFilipino ? t("language.english") : t("language.filipino"),
  })

  return (
    <button
      type="button"
      className="lang-toggle"
      onClick={toggleLanguage}
      aria-label={targetLabel}
      title={targetLabel}
    >
      <Languages className="lang-toggle__glyph" aria-hidden="true" />
      <span className="lang-toggle__code">{activeShort}</span>
    </button>
  )
}
