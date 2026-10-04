import { LogOut, Shield, User as UserIcon, Moon, Sun, Languages } from "lucide-react"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/layout"
import { Avatar, Button, Card } from "@/components/ui"
import { useSession } from "@/session/useSession"
import { useTheme } from "@/theme/useTheme"
import { useLanguage } from "@/i18n/useLanguage"
import { cn } from "@/lib/cn"
import "./ProfilePage.css"

/**
 * ProfilePage — the signed-in user's profile surface.
 *
 * Reached by clicking the avatar in the top bar (which previously signed the
 * user out immediately). Shows identity, a Preferences row that puts theme and
 * language side by side, and the sign-out action as a destructive red button.
 */
export function ProfilePage() {
  const { t } = useTranslation()
  const { user, logout } = useSession()
  const { theme, setTheme } = useTheme()
  const { language, setLanguage } = useLanguage()

  // Localized role label from the backend's role key ("teacher"/"learner").
  const roleLabel = user?.role ? t(`roles.${user.role}`, user.role) : "—"

  const themeOptions = [
    { value: "light", label: t("theme.light"), icon: Sun },
    { value: "dark", label: t("theme.dark"), icon: Moon },
  ]
  const languageOptions = [
    { value: "en", label: t("language.english") },
    { value: "fil", label: t("language.filipino") },
  ]

  return (
    <div className="stack">
      <PageHeader
        eyebrow={t("profile.eyebrow")}
        title={t("profile.title")}
        subtitle={t("profile.subtitle")}
      />

      <Card>
        <Card.Body>
          <div className="profile__identity">
            <Avatar name={user?.name ?? ""} size="lg" />
            <div className="profile__identity-text">
              <p className="profile__name">
                {user?.name ?? t("profile.unknownUser")}
              </p>
              <p className="profile__role">
                <Shield className="profile__role-icon" aria-hidden="true" />
                {roleLabel}
              </p>
            </div>
          </div>

          <dl className="profile__facts">
            <div className="profile__fact">
              <dt className="profile__fact-label">
                <UserIcon className="profile__fact-icon" aria-hidden="true" />
                {t("profile.name")}
              </dt>
              <dd className="profile__fact-value">{user?.name ?? "—"}</dd>
            </div>
            <div className="profile__fact">
              <dt className="profile__fact-label">
                <Shield className="profile__fact-icon" aria-hidden="true" />
                {t("profile.role")}
              </dt>
              <dd className="profile__fact-value">{roleLabel}</dd>
            </div>
          </dl>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header
          title={t("profile.preferences")}
          subtitle={t("profile.preferencesSub")}
        />
        <Card.Body>
          <div className="profile__prefs">
            {/* Theme */}
            <div className="profile__pref">
              <span className="profile__pref-label">
                <Sun className="profile__pref-icon" aria-hidden="true" />
                {t("theme.label")}
              </span>
              <div
                className="profile__segmented"
                role="radiogroup"
                aria-label={t("theme.label")}
              >
                {themeOptions.map((option) => {
                  const Icon = option.icon
                  const active = theme === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={cn(
                        "profile__segment",
                        active && "profile__segment--active",
                      )}
                      onClick={() => setTheme(option.value)}
                    >
                      <Icon aria-hidden="true" />
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Language */}
            <div className="profile__pref">
              <span className="profile__pref-label">
                <Languages className="profile__pref-icon" aria-hidden="true" />
                {t("language.label")}
              </span>
              <div
                className="profile__segmented"
                role="radiogroup"
                aria-label={t("language.label")}
              >
                {languageOptions.map((option) => {
                  const active = language === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={cn(
                        "profile__segment",
                        active && "profile__segment--active",
                      )}
                      onClick={() => setLanguage(option.value)}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header
          title={t("profile.signOut")}
          subtitle={t("profile.signOutSub")}
        />
        <Card.Body>
          <Button variant="danger" icon={LogOut} onClick={logout}>
            {t("profile.signOut")}
          </Button>
        </Card.Body>
      </Card>
    </div>
  )
}
