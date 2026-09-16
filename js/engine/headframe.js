/**
 * SMILE-FA — engine/headframe.js  (T-06)
 *
 * Builds the head frame (HF) and mm scale from a single frame's landmarks
 * (Data Dictionary §0.2). Pure, DOM-free (tech.md).
 *
 * HF convention (§0):
 *   origin = midpoint of pupil (iris) centres
 *   +X toward patient's LEFT
 *   +Y up (superior)
 *   +Z toward camera (anterior)
 *
 * Pipeline:
 *   1. Landmarks come in normalised image coords {x,y,z}. Convert to isotropic
 *      units: X = x·W, Y = y·H, Z = z·W  (image Y grows downward).
 *   2. Fit the midsagittal plane from stable bilateral pairs + midline points.
 *   3. Build axes: X = plane normal (signed to patient-left),
 *      Y = up (from projected menton→nasion), Z = X × Y.
 *   4. mm scale from iris diameter (11.7 mm).
 *   5. Transform points into HF (mm) with origin at pupil midpoint.
 *
 * @module engine/headframe
 */

import { sub, add, scale, dot, cross, norm, normalize, mean, dist } from './vec.js';

/** @typedef {{x:number, y:number, z:number}} Vec3 */

/**
 * Convert normalised landmarks to isotropic pixel-space (image Y downward).
 * @param {Array<{x:number,y:number,z:number}>} landmarks
 * @param {number} w image width
 * @param {number} h image height
 * @returns {Vec3[]}
 */
export function toIsotropic(landmarks, w, h) {
  return landmarks.map((p) => ({ x: p.x * w, y: p.y * h, z: (p.z ?? 0) * w }));
}

/**
 * Dominant eigenvector of a 3×3 symmetric matrix via power iteration.
 * @param {number[][]} m 3×3
 * @returns {Vec3} unit dominant eigenvector
 */
function dominantEigenvector(m) {
  let v = { x: 1, y: 0.3, z: -0.2 };
  for (let iter = 0; iter < 64; iter++) {
    const nv = {
      x: m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.z,
      y: m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.z,
      z: m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.z,
    };
    const n = norm(nv);
    if (n < 1e-12) break;
    v = { x: nv.x / n, y: nv.y / n, z: nv.z / n };
  }
  return v;
}

/**
 * Least-dominant eigenvector (plane normal of a set of near-coplanar points):
 * eigenvector of the smallest eigenvalue of the covariance. We get it as the
 * dominant eigenvector of (trace·I − C), a standard deflation trick.
 * @param {number[][]} c covariance 3×3
 * @returns {Vec3}
 */
function smallestEigenvector(c) {
  const trace = c[0][0] + c[1][1] + c[2][2];
  const d = [
    [trace - c[0][0], -c[0][1], -c[0][2]],
    [-c[1][0], trace - c[1][1], -c[1][2]],
    [-c[2][0], -c[2][1], trace - c[2][2]],
  ];
  return dominantEigenvector(d);
}

/** Covariance (3×3) of a set of vectors around their mean. */
function covariance(vecs) {
  const m = mean(vecs);
  const c = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of vecs) {
    const d = sub(p, m);
    c[0][0] += d.x * d.x; c[0][1] += d.x * d.y; c[0][2] += d.x * d.z;
    c[1][0] += d.y * d.x; c[1][1] += d.y * d.y; c[1][2] += d.y * d.z;
    c[2][0] += d.z * d.x; c[2][1] += d.z * d.y; c[2][2] += d.z * d.z;
  }
  return c;
}

/** Covariance of vectors treated as directions from origin (no mean removal). */
function scatterAboutOrigin(vecs) {
  const c = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const d of vecs) {
    c[0][0] += d.x * d.x; c[0][1] += d.x * d.y; c[0][2] += d.x * d.z;
    c[1][0] += d.y * d.x; c[1][1] += d.y * d.y; c[1][2] += d.y * d.z;
    c[2][0] += d.z * d.x; c[2][1] += d.z * d.y; c[2][2] += d.z * d.z;
  }
  return c;
}

/**
 * Estimate iris diameter (isotropic units) from the four ring points per eye.
 * Uses the two opposite-pair diameters and averages.
 * @param {Vec3[]} iso isotropic landmarks
 * @param {number[]} ring 4 indices [a,b,c,d] where a↔c and b↔d are diameters
 * @returns {number}
 */
export function irisDiameter(iso, ring) {
  const [a, b, c, d] = ring;
  return (dist(iso[a], iso[c]) + dist(iso[b], iso[d])) / 2;
}

/**
 * Build the head frame from one frame of landmarks.
 *
 * @param {Array<{x:number,y:number,z:number}>} landmarks normalised (478)
 * @param {number} w image width px
 * @param {number} h image height px
 * @param {object} cfg landmarks.json config (indices)
 * @returns {{
 *   origin: Vec3, X: Vec3, Y: Vec3, Z: Vec3,
 *   mmPerUnit: number, irisDiamR: number, irisDiamL: number,
 *   toHF: (p:Vec3)=>Vec3, transformIndex:(i:number)=>Vec3, iso: Vec3[]
 * }}
 */
export function buildHeadFrame(landmarks, w, h, cfg) {
  const iso = toIsotropic(landmarks, w, h);
  const idxAt = (i) => iso[i];

  // --- Midsagittal plane normal from stable bilateral pair vectors ---------
  // For each stable pair, d = p_L − p_R points roughly along +X (patient left).
  const pairVecs = cfg.headframe_fit.bilateral_pairs.map((p) => sub(iso[p.L], iso[p.R]));
  // The plane normal is the direction these difference vectors share:
  // it's the DOMINANT direction of the pair-vector scatter about the origin.
  let normal = dominantEigenvector(scatterAboutOrigin(pairVecs));

  // Sign so +X points toward patient LEFT (mean pair vector direction).
  const meanPair = mean(pairVecs);
  if (dot(normal, meanPair) < 0) normal = scale(normal, -1);
  const X = normalize(normal);

  // --- Origin: iris (pupil) midpoint ---------------------------------------
  const irisR = cfg.points.iris_centre.R;
  const irisL = cfg.points.iris_centre.L;
  const origin = mean([idxAt(irisR), idxAt(irisL)]);

  // --- Y axis: up. menton (152) → nasion (168) projected off X -------------
  const menton = idxAt(cfg.midline.menton);
  const nasion = idxAt(cfg.midline.nasion);
  let up = sub(nasion, menton); // points superior in isotropic (image Y down → this is negative Y)
  // Remove any X component so Y ⟂ X.
  up = sub(up, scale(X, dot(up, X)));
  const Y = normalize(up);

  // --- Z axis: anterior = X × Y --------------------------------------------
  const Z = normalize(cross(X, Y));

  // --- mm scale from iris diameter -----------------------------------------
  const irisDiamR = irisDiameter(iso, cfg.iris_ring.R);
  const irisDiamL = irisDiameter(iso, cfg.iris_ring.L);
  const meanIris = (irisDiamR + irisDiamL) / 2;
  const mmPerUnit = meanIris > 1e-6 ? cfg.convention.iris_diameter_mm / meanIris : NaN;

  /**
   * Transform an isotropic point into HF (mm): rotate onto axes, scale to mm.
   * @param {Vec3} p
   * @returns {Vec3}
   */
  const toHF = (p) => {
    const rel = sub(p, origin);
    return {
      x: dot(rel, X) * mmPerUnit,
      y: dot(rel, Y) * mmPerUnit,
      z: dot(rel, Z) * mmPerUnit,
    };
  };

  /** Transform a landmark index directly. */
  const transformIndex = (i) => toHF(iso[i]);

  return { origin, X, Y, Z, mmPerUnit, irisDiamR, irisDiamL, toHF, transformIndex, iso };
}

/**
 * Transform every landmark into HF mm coordinates.
 * @param {ReturnType<typeof buildHeadFrame>} hf
 * @returns {Vec3[]}
 */
export function transformAll(hf) {
  return hf.iso.map((p) => hf.toHF(p));
}

/**
 * Inter-ocular distance (IOD) in HF mm — used for %IOD normalisation.
 * @param {ReturnType<typeof buildHeadFrame>} hf
 * @param {object} cfg
 * @returns {number}
 */
export function iodMm(hf, cfg) {
  const l = hf.transformIndex(cfg.points.iris_centre.L);
  const r = hf.transformIndex(cfg.points.iris_centre.R);
  return dist(l, r);
}
