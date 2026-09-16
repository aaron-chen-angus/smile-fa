/**
 * SMILE-FA — engine/frameMetrics.js  (T-08)
 *
 * Per-frame primitives in head-frame (HF) mm. Pure, DOM-free. These are the
 * building blocks phaseMetrics.js aggregates into R/B/E/S/P/N/V metrics.
 *
 * All positions are in HF mm (patient-left +X, up +Y, anterior +Z).
 *
 * @module engine/frameMetrics
 */

import { dist, mean as vmean } from './vec.js';

/**
 * @typedef {{x:number,y:number,z:number}} Vec3
 * @typedef {(i:number)=>Vec3} XformIndex   HF transform of a landmark index
 */

/**
 * Compute per-frame primitives from a head frame.
 *
 * @param {import('./headframe.js').buildHeadFrame extends (...a:any)=>infer R ? R : any} hf
 * @param {object} cfg landmarks config
 * @param {number[]} blendshapes 52 raw coefficients (optional; [] if absent)
 * @param {object} [bsIndex] map of blendshape name -> index (optional)
 * @returns {object} primitives keyed for downstream metrics
 */
export function computeFramePrimitives(hf, cfg, blendshapes = [], bsIndex = null) {
  const T = (i) => hf.transformIndex(i);
  const P = cfg.points;

  const commL = T(P.oral_commissure.L);
  const commR = T(P.oral_commissure.R);

  // Palpebral fissure height (PFH) = |upper eyelid − lower eyelid| in HF mm.
  const pfhL = dist(T(P.upper_eyelid_mid.L), T(P.lower_eyelid_mid.L));
  const pfhR = dist(T(P.upper_eyelid_mid.R), T(P.lower_eyelid_mid.R));

  // Brow height = perpendicular HF Y distance brow_mid ↔ iris_centre (Emotrics).
  const browHeightL = T(P.brow_mid.L).y - T(P.iris_centre.L).y;
  const browHeightR = T(P.brow_mid.R).y - T(P.iris_centre.R).y;

  // Upper-lip peaks (levator) — Y position.
  const lipPeakL = T(P.upper_lip_peak.L);
  const lipPeakR = T(P.upper_lip_peak.R);

  // Mouth centre (mean of lip mids + commissures) for midline shift.
  const mouthCentre = vmean([
    T(cfg.midline.upper_lip_outer_mid),
    T(cfg.midline.lower_lip_outer_mid),
    commL, commR,
  ]);

  // Cheeks (malar).
  const cheekL = T(P.cheek_malar.L);
  const cheekR = T(P.cheek_malar.R);

  return {
    commL, commR,
    commHeightL: commL.y, commHeightR: commR.y,
    commMidlineDistL: Math.abs(commL.x), commMidlineDistR: Math.abs(commR.x),
    pfhL, pfhR,
    browHeightL, browHeightR,
    lipPeakL, lipPeakR,
    mouthCentre,
    cheekL, cheekR,
    blendshapes,
    bsIndex,
  };
}

/**
 * Global Symmetry Index (GSI): mean over bilateral pairs of the distance
 * between a point and the MIRROR of its partner across the midsagittal plane,
 * normalised by IOD, ×100 (Data Dictionary R13). In HF the mirror across the
 * plane (x=0) is (−x, y, z), so we compare T(L) with mirror(T(R)).
 *
 * @param {(i:number)=>Vec3} T HF transform
 * @param {Array<{L:number,R:number}>} pairs bilateral index pairs
 * @param {number} iodMm inter-ocular distance in mm
 * @returns {number} % IOD
 */
export function globalSymmetryIndex(T, pairs, iodMm) {
  if (!pairs.length || iodMm <= 0) return NaN;
  let acc = 0;
  for (const { L, R } of pairs) {
    const pl = T(L);
    const pr = T(R);
    const mirroredR = { x: -pr.x, y: pr.y, z: pr.z };
    acc += dist(pl, mirroredR);
  }
  return (acc / pairs.length / iodMm) * 100;
}

/**
 * Default GSI pairs: a spread of stable + expressive bilateral landmarks.
 * Perioral-only subset (for R14 lower-face GSI) is marked.
 * @param {object} cfg landmarks config
 * @returns {{all: Array<{L:number,R:number}>, perioral: Array<{L:number,R:number}>}}
 */
export function gsiPairs(cfg) {
  const P = cfg.points;
  const all = [
    { L: P.oral_commissure.L, R: P.oral_commissure.R },
    { L: P.upper_lip_peak.L, R: P.upper_lip_peak.R },
    { L: P.eye_outer_canthus.L, R: P.eye_outer_canthus.R },
    { L: P.eye_inner_canthus.L, R: P.eye_inner_canthus.R },
    { L: P.upper_eyelid_mid.L, R: P.upper_eyelid_mid.R },
    { L: P.lower_eyelid_mid.L, R: P.lower_eyelid_mid.R },
    { L: P.brow_mid.L, R: P.brow_mid.R },
    { L: P.brow_inner.L, R: P.brow_inner.R },
    { L: P.brow_outer.L, R: P.brow_outer.R },
    { L: P.nasal_ala.L, R: P.nasal_ala.R },
    { L: P.cheek_malar.L, R: P.cheek_malar.R },
    { L: P.tragion_contour.L, R: P.tragion_contour.R },
  ];
  const perioral = [
    { L: P.oral_commissure.L, R: P.oral_commissure.R },
    { L: P.upper_lip_peak.L, R: P.upper_lip_peak.R },
    { L: P.nasal_ala.L, R: P.nasal_ala.R },
    { L: P.cheek_malar.L, R: P.cheek_malar.R },
  ];
  return { all, perioral };
}

/**
 * Read a blendshape score by MediaPipe category name.
 * @param {number[]} blendshapes raw coefficient array
 * @param {Record<string,number>} bsIndex name -> index map
 * @param {string} name
 * @returns {number} 0 if unavailable
 */
export function bs(blendshapes, bsIndex, name) {
  if (!bsIndex || !(name in bsIndex)) return 0;
  const i = bsIndex[name];
  return typeof blendshapes[i] === 'number' ? blendshapes[i] : 0;
}

/**
 * Resolve a side-suffixed blendshape name using the verified side_map.
 * e.g. sideBs('mouthSmile','L', map) → 'mouthSmileLeft' when patient_L→'left'.
 * @param {string} base e.g. 'mouthSmile'
 * @param {'L'|'R'} side patient side
 * @param {{patient_L:string, patient_R:string}} sideMap from landmarks.json
 * @returns {string} full MediaPipe category name
 */
export function sideBsName(base, side, sideMap) {
  const suffix = side === 'L' ? sideMap.patient_L : sideMap.patient_R;
  return base + (suffix === 'left' ? 'Left' : 'Right');
}
