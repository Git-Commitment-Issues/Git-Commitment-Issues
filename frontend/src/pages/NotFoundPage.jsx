import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui'
import { Mascot } from '@/components/brand/Mascot'
import './NotFoundPage.css'

/**
 * NotFoundPage — fallback for unmatched routes. The skeptical dragon sets a
 * light tone for the "nothing here" moment.
 */
export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <Card padded>
      <div className="notfound">
        <Mascot variant="skeptical" size="lg" className="notfound__mascot" />
        <h3 className="notfound__title">{t('notFound.title')}</h3>
        <p className="notfound__text">{t('notFound.text')}</p>
        <Link to="/" className="text-link">
          {t('notFound.goDashboard')}
        </Link>
      </div>
    </Card>
  )
}
