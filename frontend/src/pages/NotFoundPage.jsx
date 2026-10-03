import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Card } from '@/components/ui'

/**
 * NotFoundPage — fallback for unmatched routes.
 */
export function NotFoundPage() {
  return (
    <Card padded>
      <div className="empty-state">
        <span className="empty-state__icon">
          <Compass aria-hidden="true" />
        </span>
        <h3>Page not found</h3>
        <p>
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
