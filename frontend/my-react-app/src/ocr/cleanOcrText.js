// Clean up raw OCR text into readable paragraphs.
//
// Tesseract returns text exactly as it saw it on the page. On a real document
// that produces two problems:
//   1. Logos, seals, stamps, and signatures get read as garbage lines
//      ("3g R 2", "ana CE NG", "© LUNGSOD NG M", stray single characters).
//   2. A sentence that wrapped across several printed lines comes back as
//      several short lines instead of one flowing sentence.
//
// cleanOcrText drops the junk and re-flows wrapped lines into paragraphs. It is
// deliberately conservative: leaving a questionable line in (the teacher can
// delete it in the correction view) is safer than stripping real text. This
// mirrors the sprint plan's "clean OCR text, fix hyphenation" structuring step.

// A line is junk if it is mostly symbols/digits/stray marks rather than words —
// i.e. logo, seal, border, or signature noise.
function isJunkLine(line) {
  const trimmed = line.trim();
  if (trimmed.length === 0) return false; // blank lines mark paragraph breaks

  // Count real letters, including common accented and Filipino letters.
  const letters = (trimmed.match(/[A-Za-zÀ-ÿñÑ]/g) || []).length;

  // Very short lines with at most one letter are almost always noise ("©", "3g").
  if (trimmed.length <= 3 && letters <= 1) return true;

  // Pure symbols/numbers with no letters at all ("3 3 ra", ">") — junk here.
  if (letters === 0) return true;

  // Longer lines that are less than ~40% letters are likely logo/seal/border
  // fragments rather than a real sentence.
  if (trimmed.length >= 4 && letters / trimmed.length < 0.4) return true;

  return false;
}

// A wrapped line should join the previous one with a space unless the previous
// line clearly ended a sentence (so distinct sentences are not glued together).
function endsSentence(line) {
  return /[.!?:;"”’)]$/.test(line.trim());
}

/**
 * Clean raw OCR text.
 *
 * @param {string} rawText - the text field returned by the OCR engine.
 * @returns {string} cleaned text with junk lines removed and wrapped lines
 *   re-flowed into readable paragraphs.
 */
export function cleanOcrText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  // 1. Drop junk lines; keep blank lines as paragraph separators.
  const kept = [];
  for (const line of rawText.split(/\r?\n/)) {
    if (line.trim().length === 0) kept.push('');
    else if (!isJunkLine(line)) kept.push(line.trim());
  }

  // 2. Collapse leading and duplicate blank lines into single paragraph breaks.
  const collapsed = [];
  for (const line of kept) {
    const lastBlank =
      collapsed.length > 0 && collapsed[collapsed.length - 1] === '';
    if (line === '' && (lastBlank || collapsed.length === 0)) continue;
    collapsed.push(line);
  }

  // 3. Re-flow wrapped lines into paragraphs; fix hyphenation across breaks.
  let out = '';
  for (let i = 0; i < collapsed.length; i += 1) {
    const line = collapsed[i];

    if (line === '') {
      out += '\n\n'; // paragraph break
      continue;
    }
    if (out === '' || out.endsWith('\n\n')) {
      out += line; // first line of a paragraph
      continue;
    }

    const prev = collapsed[i - 1];
    if (prev && prev.endsWith('-')) {
      out = out.slice(0, -1) + line; // split word: drop hyphen, glue together
    } else if (prev && !endsSentence(prev)) {
      out += ' ' + line; // same sentence continues on the next line
    } else {
      out += '\n' + line; // previous line ended a sentence
    }
  }

  return out.trim();
}
