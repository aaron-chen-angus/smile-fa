/**
 * SMILE-FA — engine/nasolabial.js  (T-10, R10/R11) — EXPERIMENTAL
 *
 * Nasolabial fold depth proxy: Sobel gradient-energy in an ROI bounded by
 * ala–commissure–malar landmarks, per side (Data Dictionary R10). Highly
 * lighting-sensitive; valid only when Q09 ≥ 0.85 (R11). Pure, DOM-free:
 * receives grayscale/RGBA pixels + ROI polygon in pixel coords.
 *
 * This metric is flagged EXPERIMENTAL everywhere it surfaces.
 *
 * @module engine/nasolabial
 */

import { pointInPolygon } from './dental.js';

export const EXPERIMENTAL = true;

/** Luminance (Rec. 601) of an RGBA pixel. */
function luma(rgba, idx) {
  return 0.299 * rgba[idx] + 0.587 * rgba[idx + 1] + 0.114 * rgba[idx + 2];
}

/**
 * Mean Sobel gradient magnitude inside an ROI polygon (pixel coords).
 *
 * @param {Uint8ClampedArray} rgba
 * @param {number} w
 * @param {number} h
 * @param {{x:number,y:number}[]} roiPoly
 * @returns {number} mean gradient magnitude (a.u.), 0 if ROI empty
 */
export function gradientEnergy(rgba, w, h, roiPoly) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of roiPoly) {
    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
  }
  const x0 = Math.max(1, Math.floor(minX));
  const x1 = Math.min(w - 2, Math.ceil(maxX));
  const y0 = Math.max(1, Math.floor(minY));
  const y1 = Math.min(h - 2, Math.ceil(maxY));

  let acc = 0, count = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!pointInPolygon(x, y, roiPoly)) continue;
      const i = (y * w + x) * 4;
      const iL = (y * w + (x - 1)) * 4, iR = (y * w + (x + 1)) * 4;
      const iU = ((y - 1) * w + x) * 4, iD = ((y + 1) * w + x) * 4;
      // 3x1 / 1x3 Sobel-ish central differences.
      const gx = luma(rgba, iR) - luma(rgba, iL);
      const gy = luma(rgba, iD) - luma(rgba, iU);
      acc += Math.hypot(gx, gy);
      count++;
    }
  }
  return count > 0 ? acc / count : 0;
}

/**
 * ROI polygon for one nasolabial fold from ala, commissure, malar (pixel).
 * @param {{x:number,y:number}} ala
 * @param {{x:number,y:number}} commissure
 * @param {{x:number,y:number}} malar
 * @returns {{x:number,y:number}[]}
 */
export function nasolabialRoi(ala, commissure, malar) {
  // Triangle-ish ROI; caller may inset. Kept simple and explicit.
  return [ala, commissure, malar];
}

/**
 * Compute R10/R11: per-side gradient energy + symmetry ratio, gated on Q09.
 *
 * @param {Uint8ClampedArray} rgba
 * @param {number} w @param {number} h
 * @param {{ala:{x,y}, commissure:{x,y}, malar:{x,y}}} left  patient LEFT ROI pts
 * @param {{ala:{x,y}, commissure:{x,y}, malar:{x,y}}} right patient RIGHT ROI pts
 * @param {number} q09 lighting side ratio
 * @param {number} q09Min minimum Q09 to trust (thresholds R11.requires_Q09_min)
 * @returns {{R10_L:number, R10_R:number, R11:number|null, experimental:true, reason:string|null}}
 */
export function nasolabialMetrics(rgba, w, h, left, right, q09, q09Min = 0.85) {
  const eL = gradientEnergy(rgba, w, h, nasolabialRoi(left.ala, left.commissure, left.malar));
  const eR = gradientEnergy(rgba, w, h, nasolabialRoi(right.ala, right.commissure, right.malar));
  let R11 = null, reason = null;
  if (q09 < q09Min) {
    reason = 'low_quality'; // lighting too uneven to trust (R11)
  } else {
    const hi = Math.max(eL, eR), lo = Math.min(eL, eR);
    R11 = hi > 0 ? lo / hi : null;
  }
  return { R10_L: eL, R10_R: eR, R11, experimental: true, reason };
}
