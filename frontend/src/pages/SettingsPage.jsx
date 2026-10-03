import { Moon, Sun, User, School, Bell } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { Card, Input, Button } from '@/components/ui'
import { useTheme } from '@/theme/useTheme'
import { cn } from '@/lib/cn'
import './SettingsPage.css'

/**
 * SettingsPage — account, class, and appearance preferences. The appearance
 * section is fully wired to the theme context; the rest are structural
 * placeholders ready to connect to the backend.
 */
export function SettingsPage() {
  const { theme, setTheme } = useTheme()

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
  ]

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        subtitle="Manage your account, class details, and how pahina. looks and notifies you."
      />

      <Card>
        <Card.Header
          title="Appearance"
          subtitle="Choose how pahina. looks on this device"
        />
        <Card.Body>
          <div
            className="settings__theme"
            role="radiogroup"
            aria-label="Theme"
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
        </Card.Body>
      </Card>

      <Card>
        <Card.Header
          title="Account"
          subtitle="Your teacher profile"
          action={
            <span className="settings__icon-chip">
              <User aria-hidden="true" />
            </span>
          }
        />
        <Card.Body>
          <div className="settings__grid">
            <Input label="Full name" defaultValue="Elena Reyes" />
            <Input
              label="Email"
              type="email"
              defaultValue="e.reyes@school.edu"
            />
          </div>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header
          title="Class"
          subtitle="Details shown on assessments and reports"
          action={
            <span className="settings__icon-chip">
              <School aria-hidden="true" />
            </span>
          }
        />
        <Card.Body>
          <div className="settings__grid">
            <Input label="Class name" defaultValue="Grade 8 English" />
            <Input label="Section" defaultValue="Section A" />
          </div>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header
          title="Notifications"
          subtitle="When pahina. should alert you"
          action={
            <span className="settings__icon-chip">
              <Bell aria-hidden="true" />
            </span>
          }
        />
        <Card.Body>
          <p className="settings__placeholder">
            Notification preferences — such as alerts when an assessment session
            closes or when a student is flagged for support — will be
            configurable here.
          </p>
        </Card.Body>
      </Card>

      <div className="settings__actions">
        <Button variant="ghost">Discard</Button>
        <Button variant="primary">Save changes</Button>
      </div>
    </div>
  )
}
