import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Loader2, Check } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { recognize, warmUpOcr, terminateOcr } from '@/ocr/ocrEngine'
import { LOW_CONFIDENCE_THRESHOLD } from '@/ocr/ocrConfig'
import './ImportPanel.css'

/**
 * ImportPanel — scan a printed page with the in-browser OCR engine and feed the
 * extracted passage into the assessment editor.
 *
 * The teacher snaps or uploads a photo; Tesseract.js reads it on the device
 * (no backend, no AI cost); the text appears in an editable box the teacher can
 * correct; "Use this passage" calls onApply({ passage_text }).
 *
 * Props:
 *   onApply({ passage_text }) - receives the corrected passage text.
 */
export function ImportPanel({ onApply }) {
  const inputRef = useRef(null)
  const [isScanning, setIsScanning] = useState(false)
  const [progress, setProgress] = useState(0) // 0..1
  const [ocrWords, setOcrWords] = useState([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [applied, setApplied] = useState(false)

  // Warm up the OCR engine when the panel appears so language data is ready
  // before the teacher takes a photo. Free the worker on unmount.
  useEffect(() => {
    warmUpOcr().catch(() => {})
    return () => {
      terminateOcr().catch(() => {})
    }
  }, [])

  // Distinct low-confidence words to flag for review.
  const lowConfidenceWords = useMemo(() => {
    const seen = new Set()
    const flagged = []
    for (const word of ocrWords) {
      const w = (word.text ?? '').trim()
      if (!w) continue
      if (
        typeof word.confidence === 'number' &&
        word.confidence < LOW_CONFIDENCE_THRESHOLD &&
        !seen.has(w.toLowerCase())
      ) {
        seen.add(w.toLowerCase())
        flagged.push(w)
      }
    }
    return flagged
  }, [ocrWords])

  async function handleFileChange(event) {
    const file = event.target.files && event.target.files[0]
    if (!file) return

    setIsScanning(true)
    setProgress(0)
    setError('')
    setApplied(false)

    try {
      const result = await recognize(file, (value) => setProgress(value))
      setText(result.text || '')
      setOcrWords(result.words || [])
      if (!result.text || !result.text.trim()) {
        setError(
          'We couldn’t read any text. Try a clearer, well-lit photo of the page.',
        )
      }
    } catch {
      setError('Something went wrong reading that photo. Please try another image.')
    } finally {
      setIsScanning(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function handleApply() {
    if (typeof onApply === 'function') {
      onApply({ passage_text: text.trim() })
    }
    setApplied(true)
  }

  const percent = Math.round(progress * 100)
  const hasText = text.trim().length > 0

  return (
    <Card className="import-panel">
      <div className="import-panel__head">
        <h3 className="import-panel__title">Scan a printed page</h3>
        <p className="import-panel__subtitle">
          Photograph a book page or document. The text is read on your device —
          no upload, no AI cost.
        </p>
      </div>

      <input
        ref={inputRef}
        id="import-panel-capture"
        className="import-panel__input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        disabled={isScanning}
      />

      <Button
        icon={isScanning ? Loader2 : Camera}
        variant="primary"
        onClick={() => inputRef.current && inputRef.current.click()}
        disabled={isScanning}
      >
        {isScanning ? 'Reading page…' : 'Snap or upload a page'}
      </Button>

      {isScanning && (
        <div
          className="import-panel__progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Reading page progress"
        >
          <div
            className="import-panel__progress-bar"
            style={{ width: `${percent}%` }}
          />
          <span className="import-panel__progress-text">{percent}%</span>
        </div>
      )}

      {error && (
        <p className="import-panel__error" aria-live="polite">
          {error}
        </p>
      )}

      {hasText && (
        <>
          {lowConfidenceWords.length > 0 && (
            <div className="import-panel__flags">
              <span className="import-panel__flags-label">
                Words to double-check:
              </span>
              <ul className="import-panel__flags-list">
                {lowConfidenceWords.map((word, index) => (
                  <li key={`${word}-${index}`} className="import-panel__flag">
                    {word}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label htmlFor="import-panel-text" className="import-panel__label">
            Extracted passage — fix any mistakes before using it
          </label>
          <textarea
            id="import-panel-text"
            className="import-panel__textarea"
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              setApplied(false)
            }}
            rows={12}
            spellCheck
          />

          <div className="import-panel__actions">
            <Button
              icon={applied ? Check : undefined}
              variant={applied ? 'outline' : 'accent'}
              onClick={handleApply}
              disabled={!hasText}
            >
              {applied ? 'Passage added' : 'Use this passage'}
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}
