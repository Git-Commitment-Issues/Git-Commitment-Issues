// OCR configuration for Pahina's in-browser scanner.
//
// Everything OCR-related reads its settings from here, so there is one place
// to tune behavior. No logic lives in this file — just constants.

// Languages Tesseract loads. "eng+fil" means it can read English, Filipino,
// and mixed "Taglish" pages. The traineddata for these is downloaded by
// Tesseract on first use and then cached by the browser.
export const OCR_LANGS = 'eng+fil';

// --- Image pre-processing constants ---
// Phone photos are huge (e.g. 4000px wide). OCR on a full-size image is slow
// and can crash cheap phones. We shrink the longest edge down to this many
// pixels before recognition. ~1500px keeps text sharp enough to read while
// being much faster.
export const MAX_IMAGE_DIMENSION = 1500;

// Contrast multiplier applied during pre-processing. Values above 1 push dark
// pixels darker and light pixels lighter, which helps separate printed text
// from a slightly grey or shadowed page. 1.2 is a gentle boost; raise it for
// faint photocopies, lower it if photos look blown out.
export const CONTRAST_FACTOR = 1.2;

// JPEG quality (0–1) used when we re-export the processed canvas. 0.9 keeps
// the text crisp while shrinking the data we hold in memory.
export const PROCESSED_IMAGE_QUALITY = 0.9;

// A word whose OCR confidence is below this (0–100) is treated as "unsure"
// and highlighted in the correction view so the teacher knows to double-check
// it. 70 is a reasonable starting line; tune after testing real pages.
export const LOW_CONFIDENCE_THRESHOLD = 70;
