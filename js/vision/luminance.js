/**
 * SMILE-FA — vision/luminance.js
 *
 * Samples luminance from the video on a small offscreen canvas to feed Q08
 * (mean luminance) and Q09 (hemiface side ratio). This is the DOM boundary:
 * it reads pixels here and passes plain numbers into the pure engine.
 *
 * @module vision/luminance
 */

import { lightingSideRatio } from '../engine/quality.js';

const SAMPLE_W = 160; // small for speed
let canvas = null;
let ctx = null;

function ensureCanvas(h) {
  if (!canvas) {
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d', { willReadFrequently: true });
  }
  canvas.width = SAMPLE_W;
  canvas.height = h;
}

/**
 * Sample mean luminance overall and per hemiface, split at the midline x
 * (normalised 0..1). Un-mirrored frame: patient LEFT is image right (x>mid).
 *
 * @param {HTMLVideoElement} video
 * @param {number} midlineXNorm normalised midline x (default 0.5)
 * @returns {{mean:number, leftMean:number, rightMean:number, sideRatio:number}}
 */
export function sampleLuminance(video, midlineXNorm = 0.5) {
  const vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
  const h = Math.max(1, Math.round((SAMPLE_W * vh) / vw));
  ensureCanvas(h);
  ctx.drawImage(video, 0, 0, SAMPLE_W, h);
  const { data } = ctx.getImageData(0, 0, SAMPLE_W, h);

  const midX = Math.round(midlineXNorm * SAMPLE_W);
  let sum = 0, n = 0, sumL = 0, nL = 0, sumR = 0, nR = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < SAMPLE_W; x++) {
      const i = (y * SAMPLE_W + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += lum; n++;
      // patient LEFT = image right (x > midline)
      if (x > midX) { sumL += lum; nL++; } else { sumR += lum; nR++; }
    }
  }
  const mean = n ? sum / n : 0;
  const leftMean = nL ? sumL / nL : 0;
  const rightMean = nR ? sumR / nR : 0;
  return { mean, leftMean, rightMean, sideRatio: lightingSideRatio(leftMean, rightMean) };
}
