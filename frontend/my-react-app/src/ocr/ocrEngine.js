// OCR engine: turns a photo into text using Tesseract.js.
//
// This is the core of the scanner. It runs recognition inside a Tesseract
// worker (a background thread) so the UI stays responsive and can show a
// progress bar. The image is pre-processed (downscaled + contrast) before
// recognition for speed and accuracy on low-end phones.
//
// Nothing here talks to the backend — OCR happens entirely in the browser.

import { createWorker } from 'tesseract.js';
import { OCR_LANGS } from './ocrConfig.js';
import { preprocessImage } from './preprocessImage.js';
import { cleanOcrText } from './cleanOcrText.js';

// We create the Tesseract worker once and reuse it. Loading the eng+fil
// language data is the slow part (a few seconds the first time), so rebuilding
// a worker per scan would make every scan painfully slow.
let workerPromise = null;

// Hold the latest progress callback so the worker's logger (set once at
// creation) can forward progress for the scan currently in flight.
let activeProgressHandler = null;

// Get the shared worker, creating it on first use. The logger reports progress
// events; we only care about the "recognizing text" phase, whose `progress`
// field runs 0 -> 1.
function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker(OCR_LANGS, undefined, {
      logger: (message) => {
        if (
          activeProgressHandler &&
          message.status === 'recognizing text' &&
          typeof message.progress === 'number'
        ) {
          activeProgressHandler(message.progress);
        }
      },
    });
  }
  return workerPromise;
}

/**
 * Recognize text in an image.
 *
 * @param {File|Blob} file - the photo to read.
 * @param {(progress: number) => void} [onProgress] - called with a value from
 *   0 to 1 as recognition proceeds. Optional.
 * @returns {Promise<{ text: string, words: Array<{ text: string, confidence: number }> }>}
 *   the extracted text and a per-word confidence list (confidence is 0–100).
 */
export async function recognize(file, onProgress) {
  // Register this scan's progress handler so the shared logger forwards to it.
  activeProgressHandler = typeof onProgress === 'function' ? onProgress : null;

  try {
    // 1. Clean up the image first (downscale + contrast).
    const processed = await preprocessImage(file);

    // 2. Hand it to the Tesseract worker for recognition.
    const worker = await getWorker();
    const result = await worker.recognize(processed);

    const data = result?.data ?? {};
    const words = Array.isArray(data.words)
      ? data.words.map((word) => ({
          text: word.text,
          confidence: word.confidence,
        }))
      : [];

    const rawText = (data.text ?? '').trim();
    return {
      text: cleanOcrText(rawText), // junk removed + paragraphs re-flowed
      rawText, // the untouched OCR text, in case it is needed later
      words,
    };
  } finally {
    // Clear the handler so a late progress event from this scan can't leak
    // into the next one.
    activeProgressHandler = null;
  }
}

/**
 * Warm up the OCR engine ahead of time (e.g. when the capture screen mounts)
 * so the language data is already loaded by the time the teacher takes a photo.
 * Safe to call multiple times — it reuses the same worker.
 */
export async function warmUpOcr() {
  await getWorker();
}

/**
 * Release the worker and its memory. Call this when the scanner UI unmounts to
 * free resources on low-end devices.
 */
export async function terminateOcr() {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
  }
}
