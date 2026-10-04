import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X, User, Hash, School } from 'lucide-react'
import { Input, Button } from '@/components/ui'
import registrationImage from '@/assets/pahina-registration-image.svg'
import './RegisterModal.css'

/**
 * RegisterModal — a centered, two-column sign-up dialog matching the login
 * look. Left column is the full-bleed pahina registration illustration (edge to
 * edge, no padding); right column holds the teacher/learner register form.
 *
 * NOTE: the backend currently exposes no account-creation endpoint (only
 * /auth/login). So submitting shows an honest "not available yet" message
 * rather than faking a signup. When a POST /auth/register lands, wire it in
 * `handleSubmit` where marked.
 *
 * Props:
 *   open:    boolean
 *   onClose: () => void
 */
export function RegisterModal({ open, onClose }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState('teacher') // 'teacher' | 'learner'
  const [name, setName] = useState('')
  const [lrn, setLrn] = useState('')
  const [classroom, setClassroom] = useState('')
  const [notice, setNotice] = useState('')

  if (!open) return null

  const reset = () => {
    setName('')
    setLrn('')
    setClassroom('')
    setNotice('')
  }

  const close = () => {
    reset()
    onClose?.()
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // TODO: when the backend adds account creation, call it here, e.g.
    //   await repository.register({ role: mode, name, lrn, classroom })
    // For now there is no endpoint, so we never fabricate a success.
    setNotice(t('register.notice'))
  }

  return createPortal(
    <div className="reg" role="presentation" onClick={close}>
      <div
        className="reg__panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('register.dialogLabel')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left column — full-bleed illustration, no padding. */}
        <div
          className="reg__media"
          style={{ backgroundImage: `url(${registrationImage})` }}
          aria-hidden="true"
        />

        {/* Right column — the register form. */}
        <div className="reg__form-col">
          <button
            type="button"
            className="reg__close"
            onClick={close}
            aria-label="Close"
          >
            <X aria-hidden="true" />
          </button>

          <div className="reg__head">
            <h2 className="reg__title">
              Create your pahina<span className="reg__title-accent">.</span> account
            </h2>
            <p className="reg__subtitle">
              Join as a teacher to run reading checks, or as a learner to take
              them.
            </p>
          </div>

          <div className="reg__tabs" role="tablist" aria-label="Register as">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'teacher'}
              className={`reg__tab ${mode === 'teacher' ? 'reg__tab--active' : ''}`}
              onClick={() => {
                setMode('teacher')
                setNotice('')
              }}
            >
              Teacher
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'learner'}
              className={`reg__tab ${mode === 'learner' ? 'reg__tab--active' : ''}`}
              onClick={() => {
                setMode('learner')
                setNotice('')
              }}
            >
              Learner
            </button>
          </div>

          <form className="reg__form" onSubmit={handleSubmit}>
            <Input
              label="Full name"
              icon={User}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={mode === 'teacher' ? 'e.g. Ms. Reyes' : 'e.g. Juan dela Cruz'}
              required
            />

            {mode === 'teacher' ? (
              <Input
                label="School or classroom (optional)"
                icon={School}
                value={classroom}
                onChange={(e) => setClassroom(e.target.value)}
                placeholder="e.g. Grade 8 — Section A"
              />
            ) : (
              <Input
                label="Learner Reference Number"
                icon={Hash}
                value={lrn}
                onChange={(e) => setLrn(e.target.value)}
                placeholder="12-digit LRN"
                inputMode="numeric"
                required
              />
            )}

            {notice ? (
              <p className="reg__notice" role="status">
                {notice}
              </p>
            ) : null}

            <Button type="submit" variant="primary" className="reg__submit">
              Create account
            </Button>
          </form>

          <p className="reg__foot">
            Already have an account?{' '}
            <button type="button" className="reg__link" onClick={close}>
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
