import { Link } from 'react-router-dom'
import { Card } from '@/components/ui'
import { Mascot } from '@/components/brand/Mascot'
import './NotFoundPage.css'

/**
 * NotFoundPage — fallback for unmatched routes. The skeptical dragon sets a
 * light tone for the "nothing here" moment.
 */
export function NotFoundPage() {
  return (
    <Card padded>
      <div className="notfound">
        <Mascot variant="skeptical" size="lg" className="notfound__mascot" />
        <h3 className="notfound__title">Page not found</h3>
        <p className="notfound__text">
          The page you’re looking for doesn’t exist or may have moved. Let’s get
          you back to your class overview.
        </p>
        <Link to="/" className="text-link">
          Go to dashboard
        </Link>
      </div>
    </Card>
  )
}
