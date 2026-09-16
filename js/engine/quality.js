/**
 * SMILE-FA — engine/quality.js  (T-07, R3)
 *
 * Quality gates Q01–Q17. Pure, DOM-free. Thresholds are injected from
 * config/thresholds.json (never hard-coded, tech.md / D4).
 *
 * Per-frame gating decides whether a frame is "valid" (all HARD gates pass).
 * Q14 (valid %), Q16 (repetition CV) and Q17 (summary score) are computed at
 * phase/session level from collected per-frame quality objects.
 *
 * Luminance inputs (Q08, Q09) are supplied by the caller, which samples the
 * video frame on a canvas (DOM) and passes plain numbers here to keep this
 * module DOM-free.
 *
 * @module engine/quality
 */

import { avg, stddev, clamp } from './vec.js';

/**
 * @typedef {Object} FrameQualityInput
 * @property {boolean} faceDetected       Q01
 * @property {number}  faceCount          Q02
 * @property {number}  yawDeg             Q03
 * @property {number}  pitchDeg           Q04
 * @property {number}  rollDeg            Q05
 * @property {number}  faceWidthPx        Q06
 * @property {number}  iodPx              Q07
 * @property {number}  luminanceMean      Q08 (0–255)
 * @property {number}  lightingSideRatio  Q09 (min/max hemiface luminance)
 * @property {number}  [sharpness]        Q10 (variance of Laplacian)
 * @property {number}  [fps]              Q12 effective fps
 * @property {boolean} [occlusion]        Q13
 */

/**
 * @typedef {Object} FrameQuality
 * @property {boolean} valid           all hard gates pass
 * @property {string[]} hardFails      gate ids failing hard
 * @property {string[]} warns          gate ids in warn band
 * @property {Record<string, number|boolean>} values raw values by Q id
 */

/**
 * Evaluate per-frame quality gates.
 * @param {FrameQualityInput} f
 * @param {object} thr thresholds.json
 * @returns {FrameQuality}
 */
export function frameQuality(f, thr) {
  const g = thr.quality_gates;
  const hardFails = [];
  const warns = [];

  // Q01 face detected (hard)
  if (!f.faceDetected) hardFails.push('Q01');
  // Q02 face count == 1 (hard)
  if (f.faceCount !== g.Q02_face_count) hardFails.push('Q02');
  // Q03 yaw
  if (Math.abs(f.yawDeg) > g.Q03_head_yaw_deg.hard) hardFails.push('Q03');
  else if (Math.abs(f.yawDeg) > g.Q03_head_yaw_deg.warn) warns.push('Q03');
  // Q04 pitch
  if (Math.abs(f.pitchDeg) > g.Q04_head_pitch_deg.hard) hardFails.push('Q04');
  else if (Math.abs(f.pitchDeg) > g.Q04_head_pitch_deg.warn) warns.push('Q04');
  // Q05 roll
  if (Math.abs(f.rollDeg) > g.Q05_head_roll_deg.hard) hardFails.push('Q05');
  else if (Math.abs(f.rollDeg) > g.Q05_head_roll_deg.warn) warns.push('Q05');
  // Q06 face width (hard min)
  if (f.faceWidthPx < g.Q06_face_width_px.hard_min) hardFails.push('Q06');
  // Q07 iod (warn min)
  if (f.iodPx < g.Q07_iod_px.warn_min) warns.push('Q07');
  // Q08 luminance mean (hard band)
  if (f.luminanceMean < g.Q08_luminance_mean.hard_min || f.luminanceMean > g.Q08_luminance_mean.hard_max) hardFails.push('Q08');
  // Q09 lighting side ratio (hard min, warn min) — key against false asymmetry (D3)
  if (f.lightingSideRatio < g.Q09_lighting_side_ratio.hard_min) hardFails.push('Q09');
  else if (f.lightingSideRatio < g.Q09_lighting_side_ratio.warn_min) warns.push('Q09');
  // Q10 sharpness (warn min)
  if (typeof f.sharpness === 'number' && f.sharpness < g.Q10_sharpness.warn_min) warns.push('Q10');
  // Q12 fps
  if (typeof f.fps === 'number') {
    if (f.fps < g.Q12_fps.hard_min) hardFails.push('Q12');
    else if (f.fps < g.Q12_fps.warn_min) warns.push('Q12');
  }
  // Q13 occlusion (hard)
  if (f.occlusion) hardFails.push('Q13');

  return {
    valid: hardFails.length === 0,
    hardFails,
    warns,
    values: {
      Q01: f.faceDetected, Q02: f.faceCount, Q03: f.yawDeg, Q04: f.pitchDeg,
      Q05: f.rollDeg, Q06: f.faceWidthPx, Q07: f.iodPx, Q08: f.luminanceMean,
      Q09: f.lightingSideRatio, Q10: f.sharpness ?? null, Q12: f.fps ?? null,
      Q13: !!f.occlusion,
    },
  };
}

/**
 * Q14 valid_frame_pct for a phase.
 * @param {FrameQuality[]} frames
 * @returns {number} percent 0–100
 */
export function validFramePct(frames) {
  if (!frames.length) return 0;
  const valid = frames.filter((q) => q.valid).length;
  return (valid / frames.length) * 100;
}

/**
 * Q16 repetition consistency: CV (%) of a key excursion across repetitions.
 * @param {number[]} excursions per-rep values
 * @returns {number} CV percent (0 if <2 reps)
 */
export function repetitionCV(excursions) {
  if (excursions.length < 2) return 0;
  const m = avg(excursions);
  if (m === 0) return 0;
  return (stddev(excursions) / Math.abs(m)) * 100;
}

/**
 * Normalise a single quality dimension to 0..1 (1 = ideal) for Q17.
 * @param {string} id
 * @param {number} value
 * @param {object} thr
 * @returns {number}
 */
function normalizeQ(id, value, thr) {
  const g = thr.quality_gates;
  switch (id) {
    case 'Q03': return clamp(1 - Math.abs(value) / g.Q03_head_yaw_deg.hard, 0, 1);
    case 'Q04': return clamp(1 - Math.abs(value) / g.Q04_head_pitch_deg.hard, 0, 1);
    case 'Q05': return clamp(1 - Math.abs(value) / g.Q05_head_roll_deg.hard, 0, 1);
    case 'Q06': return clamp(value / (g.Q06_face_width_px.hard_min * 2), 0, 1);
    case 'Q07': return clamp(value / (g.Q07_iod_px.warn_min * 1.5), 0, 1);
    case 'Q08': {
      // Ideal ~140; fall off toward the hard band edges.
      const mid = (g.Q08_luminance_mean.hard_min + g.Q08_luminance_mean.hard_max) / 2;
      const half = (g.Q08_luminance_mean.hard_max - g.Q08_luminance_mean.hard_min) / 2;
      return clamp(1 - Math.abs(value - mid) / half, 0, 1);
    }
    case 'Q09': return clamp((value - g.Q09_lighting_side_ratio.hard_min) / (1 - g.Q09_lighting_side_ratio.hard_min), 0, 1);
    case 'Q10': return clamp(value / (g.Q10_sharpness.warn_min * 3), 0, 1);
    case 'Q11': return clamp(1 - value / (g.Q11_jitter_rest_mm.warn_max * 2), 0, 1);
    case 'Q12': return clamp(value / g.Q12_fps.warn_min, 0, 1);
    case 'Q14': return clamp(value / 100, 0, 1);
    case 'Q16': return clamp(1 - value / (g.Q16_repetition_cv_pct.warn_above * 2), 0, 1);
    default: return 0;
  }
}

/**
 * Q17 measurement quality score: 100 × weighted mean of normalised
 * Q03–Q12, Q14, Q16 (Data Dictionary Q17).
 *
 * @param {Object} agg aggregated session values by Q id (medians etc.)
 * @param {object} thr thresholds.json
 * @returns {number} 0–100
 */
export function measurementQualityScore(agg, thr) {
  const weights = thr.q17_weights;
  let wsum = 0, acc = 0;
  for (const [id, w] of Object.entries(weights)) {
    const v = agg[id];
    if (typeof v !== 'number' || Number.isNaN(v)) continue;
    acc += w * normalizeQ(id, v, thr);
    wsum += w;
  }
  return wsum > 0 ? clamp((acc / wsum) * 100, 0, 100) : 0;
}

/**
 * Compute Q09 hemiface luminance ratio from two hemiface mean luminances.
 * @param {number} leftMean
 * @param {number} rightMean
 * @returns {number} min/max ratio
 */
export function lightingSideRatio(leftMean, rightMean) {
  const hi = Math.max(leftMean, rightMean);
  const lo = Math.min(leftMean, rightMean);
  return hi > 0 ? lo / hi : 0;
}
