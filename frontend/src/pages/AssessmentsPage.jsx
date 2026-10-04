import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, FileText, Users, Clock, Hash, QrCode } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { Button, Card, Badge, Modal, StatusBadge, EmptyState } from '@/components/ui'
import { QRCode } from '@/components/data'
import { useClassroom } from '@/session/useClassroom'
import { useAsync } from '@/hooks/useAsync'
import { repository } from '@/services'
import { ImportPanel } from './assessments/ImportPanel'
import './AssessmentsPage.css'

/**
 * AssessmentsPage — create and manage reading assessments for the active
 * classroom. The card grid, scanner (OCR ImportPanel in a modal), and create
 * flow follow the new design; the cards are loaded from the backend batch list
 * for the active classroom and each opens its share screen by access code.
 */
export function AssessmentsPage() {
  const { t } = useTranslation()
  const { activeClassroom, loading: classroomLoading } = useClassroom()
  const classroomId = activeClassroom?.id ?? null
  const [showScanner, setShowScanner] = useState(false)
  const [scannedPassage, setScannedPassage] = useState('')
  const [qrAssessment, setQrAssessment] = useState(null)

  const { data, loading } = useAsync(() => {
    if (!classroomId) return Promise.resolve([])
    return repository.listClassroomAssessments(classroomId)
  }, [classroomId])

  const assessments = data ?? []
  const isLoading = classroomLoading || loading

  return (
    <div className="stack">
      <PageHeader
        eyebrow={activeClassroom?.name ?? t('assessments.fallback')}
        title={t('assessments.title')}
        subtitle={t('assessments.subtitle')}
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button
              icon={FileText}
              variant="outline"
              onClick={() => setShowScanner((v) => !v)}
            >
              {t('assessments.scanPage')}
            </Button>
            <Button icon={Plus} variant="primary">
              <Link to="/assessments/new">{t('assessments.createAssessment')}</Link>
            </Button>
          </div>
        }
      />

      <Modal open={showScanner} onClose={() => setShowScanner(false)} size="md">
        <ImportPanel
          onApply={({ passage_text }) => {
            setScannedPassage(passage_text)
            setShowScanner(false)
          }}
        />
      </Modal>

      <Modal
        open={Boolean(qrAssessment)}
        onClose={() => setQrAssessment(null)}
        size="sm"
      >
        {qrAssessment ? (
          <div className="assessments__qr-modal">
            <h2>{t('assessments.qrTitle')}</h2>
            <p className="assessments__qr-name">{qrAssessment.title}</p>
            <QRCode
              value={`${window.location.origin}/s/${qrAssessment.access_code}`}
              size={220}
            />
            <p className="assessments__qr-code">{qrAssessment.access_code}</p>
            <p className="assessments__qr-hint">{t('assessments.qrHint')}</p>
          </div>
        ) : null}
      </Modal>

      {scannedPassage && (
        <Card>
          <h3 style={{ marginTop: 0 }}>{t('assessments.scannedReady')}</h3>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{scannedPassage}</p>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <EmptyState title={t('common.loading')} />
        </Card>
      ) : assessments.length === 0 ? (
        <Card>
          <EmptyState
            title={
              classroomId
                ? t('assessments.noAssessments')
                : t('assessments.noClassroom')
            }
            message={
              classroomId
                ? t('assessments.noAssessmentsText')
                : t('assessments.noClassroomText')
            }
          />
        </Card>
      ) : (
        <section className="assessments__grid" aria-label={t('assessments.listLabel')}>
          {assessments.map((a) => (
            <Card key={a.id} interactive className="assessment-card">
              <Link
                to={`/assessments/${a.access_code}`}
                className="assessment-card__link"
              >
                <div className="assessment-card__top">
                  <span className="assessment-card__icon">
                    <FileText aria-hidden="true" />
                  </span>
                  <StatusBadge status={a.status} />
                </div>

                <h3 className="assessment-card__title">{a.title}</h3>
                <p className="assessment-card__grade">
                  <Badge tone="primary" icon={Hash}>
                    {a.access_code}
                  </Badge>
                </p>

                <div className="assessment-card__footer">
                  <span className="assessment-card__stat">
                    <Users aria-hidden="true" />
                    {a.comprehension_score != null
                      ? `${Math.round(Number(a.comprehension_score))}%`
                      : t('assessments.notGraded')}
                  </span>
                  <span className="assessment-card__stat assessment-card__stat--muted">
                    <Clock aria-hidden="true" />
                    {a.scheduled_for}
                  </span>
                </div>
              </Link>
              <Button
                variant="outline"
                icon={QrCode}
                className="assessment-card__qr"
                onClick={() => setQrAssessment(a)}
                aria-label={t('assessments.qrFor', { title: a.title })}
              >
                {t('assessments.generateQr')}
              </Button>
            </Card>
          ))}

          {/* Create tile */}
          <Link to="/assessments/new" className="assessment-create">
            <span className="assessment-create__icon">
              <Plus aria-hidden="true" />
            </span>
            <span className="assessment-create__label">{t('assessments.newTile')}</span>
            <span className="assessment-create__hint">
              {t('assessments.newTileHint')}
            </span>
          </Link>
        </section>
      )}
    </div>
  )
}
