/**
 * SMILE-FA — engine/dental.js  (T-10, S11/S12)
 *
 * Dental show: classify teeth pixels inside the inner-lip polygon and split by
 * the plane-projected midline (Data Dictionary S11). Pure, DOM-free: receives
 * raw RGBA pixels + polygon points in PIXEL coords (the caller reads them from
 * a canvas). Returns per-side areas in px² (scaled to mm² by the caller using
 * mm_per_unit²).
 *
 * Teeth heuristic (§3 "Dental show"): in HSV, teeth = high Value (bright) and
 * low Saturation (whitish). Adaptive to the rest mouth-lip colour via a caller-
 * supplied value threshold; defaults are conservative.
 *
 * @module engine/dental
 */

/** @typedef {{x:number,y:number}} Pt2 */

/**
 * Convert an sRGB pixel to HSV components we need (s, v in 0..1).
 * @param {number} r 0-255 @param {number} g 0-255 @param {number} b 0-255
 * @returns {{s:number, v:number}}
 */
function rgbToSV(r, g, b) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const v = max;
  const s = max === 0 ? 0 : (max - min) / max;
  return { s, v };
}

/**
 * Point-in-polygon (ray casting).
 * @param {number} x @param {number} y @param {Pt2[]} poly
 * @returns {boolean}
 */
export function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = (yi > y) !== (yj > y) &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Axis-aligned bounding box of a polygon. */
function bbox(poly) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Classify dental-show area within the inner-lip polygon, split at midlineX.
 *
 * @param {Uint8ClampedArray} rgba pixel data, length = w*h*4
 * @param {number} w image width
 * @param {number} h image height
 * @param {Pt2[]} innerLipPoly polygon in pixel coords (whole mouth)
 * @param {number} midlineX pixel x of the plane-projected midline
 * @param {object} [opts]
 * @param {number} [opts.vMin=0.6] minimum Value (brightness) for teeth
 * @param {number} [opts.sMax=0.35] maximum Saturation for teeth
 * @param {'leftIsPatientL'|'leftIsPatientR'} [opts.imageSide='leftIsPatientR']
 *        In an un-mirrored frame patient LEFT is on the image RIGHT (x > midline).
 * @returns {{areaL:number, areaR:number, total:number}} pixel counts
 */
export function dentalShowArea(rgba, w, h, innerLipPoly, midlineX, opts = {}) {
  const vMin = opts.vMin ?? 0.6;
  const sMax = opts.sMax ?? 0.35;
  const { minX, minY, maxX, maxY } = bbox(innerLipPoly);
  let areaL = 0, areaR = 0;

  const x0 = Math.max(0, Math.floor(minX));
  const x1 = Math.min(w - 1, Math.ceil(maxX));
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(h - 1, Math.ceil(maxY));

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!pointInPolygon(x, y, innerLipPoly)) continue;
      const idx = (y * w + x) * 4;
      const { s, v } = rgbToSV(rgba[idx], rgba[idx + 1], rgba[idx + 2]);
      if (v >= vMin && s <= sMax) {
        // Patient LEFT = image right (x > midline) in un-mirrored frame.
        if (x > midlineX) areaL++;
        else areaR++;
      }
    }
  }
  return { areaL, areaR, total: areaL + areaR };
}

/**
 * Build the inner-lip polygon (pixel coords) from landmark indices.
 * @param {(i:number)=>{x:number,y:number}} px landmark index -> pixel point
 * @param {object} cfg landmarks config (inner_lip_polygon)
 * @returns {Pt2[]}
 */
export function innerLipPolygonPx(px, cfg) {
  const ilp = cfg.inner_lip_polygon;
  // Order R contour, midline, L contour reversed to make a closed ring.
  const ring = [
    ...ilp.R.map(px),
    ...ilp.midline.map(px),
    ...ilp.L.slice().reverse().map(px),
  ];
  return ring.map((p) => ({ x: p.x, y: p.y }));
}
