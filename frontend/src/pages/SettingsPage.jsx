import { useMemo, useState } from 'react'
import { Moon, Sun, Languages, User, School, Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/layout'
import { Card, Input, Button } from '@/components/ui'
import { useTheme } from '@/theme/useTheme'
import { useLanguage } from '@/i18n/useLanguage'
import { cn } from '@/lib/cn'
import './SettingsPage.css'

// Last-saved baseline for the editable form fields. Discard reverts the
// in-progress edits back to these values (rather than clearing the inputs),
// and Save would promote the current draft to the new baseline once a backend
// endpoint exists.
const SAVED_PROFILE = {
  fullName: 'Elena Reyes',
  email: 'e.reyes@school.edu',
  className: 'Grade 8 English',
  section: 'Section A',
}

/**
 * SettingsPage — account, class, and appearance preferences. The appearance
 * section is fully wired to the theme + language contexts; the account/class
 * fields are a controlled draft so Discard can revert edits back to the
 * last-saved values.
 */
export function SettingsPage() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { language, setLanguage } = useLanguage()

  // Draft form state, seeded from the saved baseline.
  const [form, setForm] = useState(SAVED_PROFILE)

  const setField = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  // Discard only enables when the draft actually differs from the baseline.
  const isDirty = useMemo(
    () => Object.keys(SAVED_PROFILE).some((k) => form[k] !== SAVED_PROFILE[k]),
    [form],
  )

  const handleDiscard = () => setForm(SAVED_PROFILE)

  const themeOptions = [
    { value: 'light', label: t('theme.light'), icon: Sun },
    { value: 'dark', label: t('theme.dark'), icon: Moon },
  ]
  const languageOptions = [
    { value: 'en', label: t('language.english') },
    { value: 'fil', label: t('language.filipino') },
  ]

  return (
    <div className="stack">
      <PageHeader
        eyebrow={t('settings.eyebrow')}
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
      />

      <Card>
        <Card.Header
          title={t('settings.appearance')}
          subtitle={t('settings.appearanceSub')}
        />
        <Card.Body>
          <div className="settings__field-label">
            <Sun aria-hidden="true" /> {t('theme.label')}
          </div>
          <div
            className="settings__theme"
            role="radiogroup"
            aria-label={t('theme.label')}
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
                    'settings__theme-option',
                    active && 'settings__theme-option--active',
                  )}
                  onClick={() => setTheme(option.value)}
                >
                  <Icon aria-hidden="true" />
                  {option.label}
                </button>
              )
            })}
          </div>

          <div className="settings__field-label settings__field-label--spaced">
            <Languages aria-hidden="true" /> {t('language.label')}
          </div>
          <div
            className="settings__theme"
            role="radiogroup"
            aria-label={t('language.label')}
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
                    'settings__theme-option',
                    active && 'settings__theme-option--active',
                  )}
                  onClick={() => setLanguage(option.value)}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header
          title={t('settings.account')}
          subtitle={t('settings.accountSub')}
          action={
            <span className="settings__icon-chip">
              <User aria-hidden="true" />
            </span>
          }
        />
        <Card.Body>
          <div className="settings__grid">
            <Input
              label={t('settings.fullName')}
              value={form.fullName}
              onChange={setField('fullName')}
            />
            <Input
              label={t('settings.email')}
              type="email"
              value={form.email}
              onChange={setField('email')}
            />
          </div>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header
          title={t('settings.class')}
          subtitle={t('settings.classSub')}
          action={
            <span className="settings__icon-chip">
              <School aria-hidden="true" />
            </span>
          }
        />
        <Card.Body>
          <div className="settings__grid">
            <Input
              label={t('settings.className')}
              value={form.className}
              onChange={setField('className')}
            />
            <Input
              label={t('settings.section')}
              value={form.section}
              onChange={setField('section')}
            />
          </div>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header
          title={t('settings.notifications')}
          subtitle={t('settings.notificationsSub')}
          action={
            <span className="settings__icon-chip">
              <Bell aria-hidden="true" />
            </span>
          }
        />
        <Card.Body>
          <p className="settings__placeholder">
            {t('settings.notificationsPlaceholder')}
          </p>
        </Card.Body>
      </Card>

      <div className="settings__actions">
        <Button variant="ghost" onClick={handleDiscard} disabled={!isDirty}>
          {t('common.discard')}
        </Button>
        <Button variant="primary">{t('common.save')}</Button>
      </div>
    </div>
  )
}
