import { useMemo } from 'react';
import { LOW_CONFIDENCE_THRESHOLD } from '../ocr/ocrConfig.js';
import './OcrCorrection.css';

// OcrCorrection: shows the OCR text in an editable box so the teacher can fix
// mistakes before generating a pack. Words OCR was unsure about are listed so
// the teacher knows what to double-check.
//
// Props:
//   result   - { text, words } from the OCR engine.
//   value    - the current (possibly edited) text, controlled by the parent.
//   onChange(nextText) - called when the teacher edits the text.
export default function OcrCorrection({ result, value, onChange }) {
  // Collect the distinct low-confidence words to flag for review. We dedupe so
  // a word repeated many times only shows once. We read result.words inside
  // the memo (and depend on it) so the list only recomputes when OCR words
  // actually change, not on every render.
  const lowConfidenceWords = useMemo(() => {
    const words = result?.words ?? [];
    const seen = new Set();
    const flagged = [];
    for (const word of words) {
      const text = (word.text ?? '').trim();
      if (!text) continue;
      if (
        typeof word.confidence === 'number' &&
        word.confidence < LOW_CONFIDENCE_THRESHOLD &&
        !seen.has(text.toLowerCase())
      ) {
        seen.add(text.toLowerCase());
        flagged.push(text);
      }
    }
    return flagged;
  }, [result?.words]);

  const hasText = (value ?? '').trim().length > 0;

  // Empty-result guard: OCR found nothing usable (blurry / no-text photo).
  if (!hasText) {
    return (
      <section className="ocr-correction ocr-correction--empty" aria-live="polite">
        <h2>We couldn’t read any text</h2>
        <p>
          The photo may be blurry, dark, or have no printed text. Try again with
          a clearer, well-lit shot of the page.
        </p>
      </section>
    );
  }

  return (
    <section className="ocr-correction">
      <h2>Check the text</h2>
      <p className="ocr-correction__hint">
        Fix any mistakes below before continuing. OCR is not perfect, so give it
        a quick read.
      </p>

      {lowConfidenceWords.length > 0 && (
        <div className="ocr-correction__flags">
          <span className="ocr-correction__flags-label">
            Words to double-check:
          </span>
          <ul className="ocr-correction__flags-list">
            {lowConfidenceWords.map((word, index) => (
              <li key={`${word}-${index}`} className="ocr-correction__flag">
                {word}
              </li>
            ))}
          </ul>
        </div>
      )}

      <label htmlFor="ocr-correction-textarea" className="ocr-correction__label">
        Extracted text
      </label>
      <textarea
        id="ocr-correction-textarea"
        className="ocr-correction__textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={14}
        spellCheck
      />
    </section>
  );
}
