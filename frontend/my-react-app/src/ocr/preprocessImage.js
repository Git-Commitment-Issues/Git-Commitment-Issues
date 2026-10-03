// Image pre-processing for OCR.
//
// Raw phone photos are large and often have uneven lighting. Running OCR on a
// full-size photo is slow and inaccurate. This module shrinks the image and
// boosts contrast first, so recognition is faster and cleaner — especially on
// low-end phones, which is exactly our target hardware.

import {
  MAX_IMAGE_DIMENSION,
  CONTRAST_FACTOR,
  PROCESSED_IMAGE_QUALITY,
} from './ocrConfig.js';

// Load a File/Blob into an HTMLImageElement we can draw onto a canvas.
// Returns a Promise because image decoding is asynchronous.
function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url); // free the temporary blob URL once decoded
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this image file.'));
    };
    img.src = url;
  });
}

// Work out the new size so the longest edge is at most MAX_IMAGE_DIMENSION,
// keeping the aspect ratio. Images already small enough are left as-is.
function fitWithinMax(width, height) {
  const longestEdge = Math.max(width, height);
  if (longestEdge <= MAX_IMAGE_DIMENSION) {
    return { width, height };
  }
  const scale = MAX_IMAGE_DIMENSION / longestEdge;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

// Increase contrast in place on the canvas pixel data. The standard contrast
// formula nudges each color channel away from the mid-grey point (128): dark
// pixels get darker, light pixels get lighter, so text separates from paper.
function boostContrast(imageData, factor) {
  const data = imageData.data; // flat array: [r,g,b,a, r,g,b,a, ...]
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clampByte((data[i] - 128) * factor + 128); // red
    data[i + 1] = clampByte((data[i + 1] - 128) * factor + 128); // green
    data[i + 2] = clampByte((data[i + 2] - 128) * factor + 128); // blue
    // data[i + 3] is alpha (transparency) — leave it untouched
  }
  return imageData;
}

// Keep a color value inside the valid 0–255 range.
function clampByte(value) {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return value;
}

/**
 * Pre-process an image File for OCR: downscale + contrast boost.
 *
 * @param {File|Blob} file - the photo the teacher selected or captured.
 * @returns {Promise<Blob>} a processed JPEG Blob ready to hand to the OCR
 *   engine. If anything about canvas processing is unavailable, the original
 *   file is returned unchanged so the flow never breaks.
 */
export async function preprocessImage(file) {
  // Defensive: if the browser lacks canvas, skip processing rather than crash.
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) {
    return file;
  }

  let img;
  try {
    img = await loadImageFromFile(file);
  } catch {
    // Couldn't decode — let the OCR engine try the raw file and surface its
    // own error if needed.
    return file;
  }

  const { width, height } = fitWithinMax(img.naturalWidth, img.naturalHeight);
  canvas.width = width;
  canvas.height = height;

  // Draw (and simultaneously downscale) the photo onto the canvas.
  ctx.drawImage(img, 0, 0, width, height);

  // Read pixels back, boost contrast, write them back.
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    boostContrast(imageData, CONTRAST_FACTOR);
    ctx.putImageData(imageData, 0, 0);
  } catch {
    // getImageData can fail in rare sandboxed contexts; the downscaled image
    // is still useful, so continue without the contrast step.
  }

  // Export the canvas as a JPEG Blob. Wrapped in a Promise because toBlob is
  // callback-based. Fall back to the original file if export fails.
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob || file),
      'image/jpeg',
      PROCESSED_IMAGE_QUALITY,
    );
  });
}
