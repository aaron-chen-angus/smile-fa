/**
 * SMILE-FA — tests/syntheticFace.js
 *
 * Generates a synthetic 478-landmark face with known geometry so the engine
 * can be tested against ground truth (R10.3). Only the indices used by the
 * engine are placed meaningfully; the rest are filled with plausible points.
 *
 * The face is defined in a canonical mm space, then optionally rotated and
 * projected back to normalised image coords {x,y,z} as MediaPipe would output,
 * so buildHeadFrame() runs the full pipeline in reverse.
 *
 * Axes in canonical space: +x = patient LEFT, +y = up, +z = toward camera.
 * We then map to image space: image_x grows right, image_y grows DOWN.
 *
 * @module tests/syntheticFace
 */

import landmarksCfg from './landmarksFixture.js';

const IRIS_MM = 11.7;

/**
 * Canonical landmark positions in mm (patient-left +x, up +y, camera +z).
 * Symmetric by construction unless droopMm shifts one commissure down.
 * @param {{droopMmL?:number, droopMmR?:number}} [opts]
 * @returns {Record<number, {x:number,y:number,z:number}>}
 */
function canonicalPoints(opts = {}) {
  const droopL = opts.droopMmL ?? 0;
  const droopR = opts.droopMmR ?? 0;
  const P = {};
  const set = (i, x, y, z) => { P[i] = { x, y, z }; };

  // Iris centres: pupils on the horizontal line y=0, ±31 mm (IOD ≈ 62 mm).
  set(468, -31, 0, 0);  // patient RIGHT pupil (patient right = -x)
  set(473, +31, 0, 0);  // patient LEFT pupil (+x)

  // Iris rings (radius ~5.85 mm) around each pupil, opposite pairs.
  const ring = (cx, cy, cz, [a, b, c, d]) => {
    const r = IRIS_MM / 2;
    set(a, cx - r, cy, cz); set(c, cx + r, cy, cz);
    set(b, cx, cy - r, cz); set(d, cx, cy + r, cz);
  };
  ring(-31, 0, 0, [469, 470, 471, 472]); // R
  ring(+31, 0, 0, [474, 475, 476, 477]); // L

  // Midline points (x=0).
  set(10, 0, 70, 5);   // forehead top
  set(9, 0, 30, 8);    // glabella
  set(168, 0, 20, 10); // nasion
  set(1, 0, -20, 20);  // pronasale
  set(2, 0, -30, 12);  // subnasale
  set(152, 0, -80, 0); // menton

  // Stable bilateral pairs (symmetric ±x).
  set(234, -70, 5, -30); set(454, +70, 5, -30); // tragion R/L
  set(116, -45, -15, -5); set(345, +45, -15, -5); // malar
  set(129, -12, -28, 8); set(358, +12, -28, 8);   // ala
  set(133, -14, 2, 5); set(362, +14, 2, 5);        // inner canthus

  // Eyelids (for PFH): upper above, lower below pupil, ±3.5 mm.
  set(159, -31, 3.5, 0); set(145, -31, -3.5, 0);   // R upper/lower
  set(386, +31, 3.5, 0); set(374, +31, -3.5, 0);   // L upper/lower

  // Brows above pupils.
  set(105, -31, 18, 3); set(334, +31, 18, 3);      // brow mid R/L
  set(107, -12, 20, 5); set(336, +12, 20, 5);      // brow inner
  set(70, -45, 16, 0); set(300, +45, 16, 0);       // brow outer

  // Oral commissures: y = -40 mm baseline; droop pushes DOWN (−y).
  set(61, -25, -40 - droopR, 5);   // patient RIGHT corner
  set(291, +25, -40 - droopL, 5);  // patient LEFT corner

  // Upper-lip peaks / lip midpoints.
  set(37, -8, -34, 8); set(267, +8, -34, 8);
  set(0, 0, -33, 9); set(13, 0, -35, 9);
  set(17, 0, -45, 8); set(14, 0, -37, 8);

  // Cheeks.
  set(345 in P ? 345 : 345, +45, -15, -5);

  return P;
}

/** Rotate a point by yaw (about y) then pitch (about x) then roll (about z), degrees. */
function rotate(p, yawDeg, pitchDeg, rollDeg) {
  const d2r = Math.PI / 180;
  const yaw = yawDeg * d2r, pitch = pitchDeg * d2r, roll = rollDeg * d2r;
  // yaw about Y
  let x = p.x * Math.cos(yaw) + p.z * Math.sin(yaw);
  let z = -p.x * Math.sin(yaw) + p.z * Math.cos(yaw);
  let y = p.y;
  // pitch about X
  let y2 = y * Math.cos(pitch) - z * Math.sin(pitch);
  let z2 = y * Math.sin(pitch) + z * Math.cos(pitch);
  y = y2; z = z2;
  // roll about Z
  let x2 = x * Math.cos(roll) - y * Math.sin(roll);
  let y3 = x * Math.sin(roll) + y * Math.cos(roll);
  x = x2; y = y3;
  return { x, y, z };
}

/**
 * Build a synthetic MediaPipe-style landmark array (length 478) in normalised
 * image coords for the given options.
 *
 * @param {{
 *   droopMmL?:number, droopMmR?:number,
 *   yaw?:number, pitch?:number, roll?:number,
 *   w?:number, h?:number
 * }} [opts]
 * @returns {{ landmarks: Array<{x:number,y:number,z:number}>, w:number, h:number }}
 */
export function makeFace(opts = {}) {
  const w = opts.w ?? 1280, h = opts.h ?? 720;
  const canon = canonicalPoints(opts);

  // mm → pixels: pick a scale so IOD (~62mm) spans ~300 px.
  const pxPerMm = 300 / 62;
  const cx = w / 2, cy = h / 2;

  const landmarks = new Array(478);
  // Default filler so every index exists (kept near face centre, harmless).
  for (let i = 0; i < 478; i++) landmarks[i] = { x: 0.5, y: 0.5, z: 0 };

  for (const [idxStr, p0] of Object.entries(canon)) {
    const i = Number(idxStr);
    const p = rotate(p0, opts.yaw ?? 0, opts.pitch ?? 0, opts.roll ?? 0);
    // Canonical +y is UP; image y grows DOWN → subtract.
    const px = cx + p.x * pxPerMm;
    const py = cy - p.y * pxPerMm;
    const pz = p.z * pxPerMm; // depth, same scale
    landmarks[i] = { x: px / w, y: py / h, z: pz / w };
  }

  return { landmarks, w, h };
}

export { landmarksCfg };
