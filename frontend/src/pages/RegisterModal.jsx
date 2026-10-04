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
            aria-label={t('register.close')}
          >
            <X aria-hidden="true" />
          </button>

          <div className="reg__head">
            <h2 className="reg__title">
              {t('register.titleBeforeBrand')} pahina
              <span className="reg__title-accent">.</span>{' '}
              {t('register.titleAfterBrand')}
            </h2>
            <p className="reg__subtitle">{t('register.subtitle')}</p>
          </div>

          <div className="reg__tabs" role="tablist" aria-label={t('register.registerAs')}>
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
              {t('register.teacher')}
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
              {t('register.learner')}
            </button>
          </div>

          <form className="reg__form" onSubmit={handleSubmit}>
            <Input
              label={t('register.fullName')}
              icon={User}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                mode === 'teacher'
                  ? t('register.teacherNamePlaceholder')
                  : t('register.learnerNamePlaceholder')
              }
              required
            />

            {mode === 'teacher' ? (
              <Input
                label={t('register.schoolOptional')}
                icon={School}
                value={classroom}
                onChange={(e) => setClassroom(e.target.value)}
                placeholder={t('register.schoolPlaceholder')}
              />
            ) : (
              <Input
                label={t('register.lrnLabel')}
                icon={Hash}
                value={lrn}
                onChange={(e) => setLrn(e.target.value)}
                placeholder={t('register.lrnPlaceholder')}
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
              {t('register.createAccount')}
            </Button>
          </form>

          <p className="reg__foot">
            {t('register.haveAccount')}{' '}
            <button type="button" className="reg__link" onClick={close}>
              {t('register.signIn')}
            </button>
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
