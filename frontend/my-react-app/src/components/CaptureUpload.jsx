import { useEffect, useRef, useState } from 'react';
import { recognize, warmUpOcr, terminateOcr } from '../ocr/ocrEngine.js';
import './CaptureUpload.css';

// CaptureUpload: lets the teacher pick or snap a photo of a page, runs OCR on
// it in the browser, and reports the extracted text to the parent.
//
// Props:
//   onResult(result)  - called with { text, words } when OCR finishes.
//   onError(message)  - optional; called with a user-friendly error string.
export default function CaptureUpload({ onResult, onError }) {
  const inputRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1

  // Warm up the OCR engine as soon as this screen appears, so the language
  // data is loaded before the teacher takes a photo. Terminate on unmount to
  // free memory on low-end devices.
  useEffect(() => {
    warmUpOcr().catch(() => {
      // Warm-up failure isn't fatal; the first real scan will surface any
      // genuine problem. Swallow quietly here.
    });
    return () => {
      terminateOcr().catch(() => {});
    };
  }, []);

  async function handleFileChange(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    setIsScanning(true);
    setProgress(0);

    try {
      const result = await recognize(file, (value) => setProgress(value));
      if (typeof onResult === 'function') {
        onResult(result);
      }
    } catch (err) {
      const message =
        'Something went wrong reading that photo. Please try another image.';
      if (typeof onError === 'function') {
        onError(message);
      } else {
        console.error(err);
      }
    } finally {
      setIsScanning(false);
      // Reset the input so selecting the same file again still fires a change.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const percent = Math.round(progress * 100);

  return (
    <div className="capture-upload">
      {/* Hidden native input; the styled label below triggers it. */}
      <input
        ref={inputRef}
        id="pahina-capture-input"
        className="capture-upload__input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        disabled={isScanning}
      />

      <label
        htmlFor="pahina-capture-input"
        className="capture-upload__button"
        aria-disabled={isScanning}
      >
        {isScanning ? 'Reading page…' : 'Snap or upload a page'}
      </label>

      {isScanning && (
        <div
          className="capture-upload__progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Reading page progress"
        >
          <div
            className="capture-upload__progress-bar"
            style={{ width: `${percent}%` }}
          />
          <span className="capture-upload__progress-text">{percent}%</span>
        </div>
      )}

      <p className="capture-upload__hint">
        Point your camera at a printed page, or choose a photo. The text is read
        on your device.
      </p>
    </div>
  );
}
