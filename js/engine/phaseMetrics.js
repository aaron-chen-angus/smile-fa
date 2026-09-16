/**
 * SMILE-FA — engine/phaseMetrics.js  (T-09, R5.4/R5.6)
 *
 * Rest/peak extraction and the R, B, E, S, P, N, V metrics. Pure, DOM-free.
 * Every metric returns a value object { value, unit, L, R, flag, reason } and
 * uses `null` + reason code where it cannot be computed (Data Dictionary §0
 * "Missing": not_performed, low_quality, below_floor, not_detected).
 *
 * Input model: a "phase buffer" is an array of per-frame samples:
 *   { tMs, valid, prim, blendshapes, bsIndex }
 * where `prim` is the object from computeFramePrimitives() (HF mm) plus the
 * frame's GSI values. Rest is taken from the P1 buffer; peaks from the task's
 * hold window.
 *
 * Flags (none/border/sig) are attached later by composites/thresholds; here we
 * carry the raw value + side breakdown + reason.
 *
 * @module engine/phaseMetrics
 */

import { median, percentile, avg, symmetryRatio, clamp } from './vec.js';
import { bs, sideBsName } from './frameMetrics.js';

/** Reason codes. */
export const REASON = {
  NOT_PERFORMED: 'not_performed',
  LOW_QUALITY: 'low_quality',
  BELOW_FLOOR: 'below_floor',
  NOT_DETECTED: 'not_detected',
};

/**
 * @typedef {Object} FrameSample
 * @property {number}  tMs
 * @property {boolean} valid
 * @property {object}  prim   computeFramePrimitives output
 * @property {number[]} blendshapes
 * @property {Record<string,number>} bsIndex
 */

/** @param {FrameSample[]} buf @returns {FrameSample[]} valid frames only */
const validOnly = (buf) => buf.filter((f) => f.valid);

/**
 * Build a metric result object.
 * @param {number|null} value
 * @param {string} unit
 * @param {{L?:number|null, R?:number|null, reason?:string|null}} [extra]
 * @returns {{value:number|null, unit:string, L:number|null, R:number|null, flag:string, reason:string|null}}
 */
function metric(value, unit, extra = {}) {
  return {
    value: value ?? null,
    unit,
    L: extra.L ?? null,
    R: extra.R ?? null,
    flag: 'none',
    reason: extra.reason ?? null,
  };
}

/**
 * Rest reference: per-primitive median over P1 valid frames.
 * @param {FrameSample[]} p1Buffer
 * @returns {object|null} rest primitives (median of each scalar) or null
 */
export function computeRest(p1Buffer) {
  const frames = validOnly(p1Buffer);
  if (frames.length < 3) return null;
  const pick = (sel) => median(frames.map((f) => sel(f.prim)));
  return {
    commHeightL: pick((p) => p.commHeightL),
    commHeightR: pick((p) => p.commHeightR),
    commMidlineDistL: pick((p) => p.commMidlineDistL),
    commMidlineDistR: pick((p) => p.commMidlineDistR),
    pfhL: pick((p) => p.pfhL),
    pfhR: pick((p) => p.pfhR),
    browHeightL: pick((p) => p.browHeightL),
    browHeightR: pick((p) => p.browHeightR),
    lipPeakLY: pick((p) => p.lipPeakL.y),
    lipPeakRY: pick((p) => p.lipPeakR.y),
    commLX: pick((p) => p.commL.x),
    commRX: pick((p) => p.commR.x),
    commLY: pick((p) => p.commL.y),
    commRY: pick((p) => p.commR.y),
    cheekLY: pick((p) => p.cheekL.y),
    cheekRY: pick((p) => p.cheekR.y),
    frameCount: frames.length,
  };
}

/**
 * Find the peak frame in a hold window: the frame at the 95th percentile of a
 * driver signal, then take a ±3-frame median window around it (Data Dictionary
 * §3 rest/peak). Returns the representative primitives (median in window).
 *
 * @param {FrameSample[]} buffer task phase frames
 * @param {(p:object)=>number} driver signal from primitives (higher = more effort)
 * @returns {{prim:object, driverPeak:number, frames:FrameSample[]}|null}
 */
export function computePeak(buffer, driver) {
  const frames = validOnly(buffer);
  if (frames.length < 3) return null;
  const signals = frames.map((f) => driver(f.prim));
  const p95 = percentile(signals, 95);
  // Index of the frame whose signal is closest to the 95th percentile.
  let bestI = 0, bestD = Infinity;
  for (let i = 0; i < signals.length; i++) {
    const d = Math.abs(signals[i] - p95);
    if (d < bestD) { bestD = d; bestI = i; }
  }
  const lo = Math.max(0, bestI - 3);
  const hi = Math.min(frames.length - 1, bestI + 3);
  const win = frames.slice(lo, hi + 1);
  const med = (sel) => median(win.map((f) => sel(f.prim)));
  const prim = {
    commL: { x: med((p) => p.commL.x), y: med((p) => p.commL.y), z: med((p) => p.commL.z) },
    commR: { x: med((p) => p.commR.x), y: med((p) => p.commR.y), z: med((p) => p.commR.z) },
    commHeightL: med((p) => p.commHeightL), commHeightR: med((p) => p.commHeightR),
    pfhL: med((p) => p.pfhL), pfhR: med((p) => p.pfhR),
    browHeightL: med((p) => p.browHeightL), browHeightR: med((p) => p.browHeightR),
    lipPeakL: { x: med((p) => p.lipPeakL.x), y: med((p) => p.lipPeakL.y), z: med((p) => p.lipPeakL.z) },
    lipPeakR: { x: med((p) => p.lipPeakR.x), y: med((p) => p.lipPeakR.y), z: med((p) => p.lipPeakR.z) },
    mouthCentre: { x: med((p) => p.mouthCentre.x), y: med((p) => p.mouthCentre.y), z: med((p) => p.mouthCentre.z) },
  };
  return { prim, driverPeak: p95, frames: win };
}

/* ======================================================================
 * R — Resting symmetry (P1)
 * ==================================================================== */

/**
 * @param {object} rest computeRest output
 * @returns {Record<string, object>} R metrics
 */
export function restMetrics(rest) {
  if (!rest) {
    return {
      R02: metric(null, 'mm', { reason: REASON.LOW_QUALITY }),
      R07: metric(null, 'ratio', { reason: REASON.LOW_QUALITY }),
      R09: metric(null, 'mm', { reason: REASON.LOW_QUALITY }),
    };
  }
  const out = {};

  // R01/R02 commissure height + diff
  out.R02 = metric(Math.abs(rest.commHeightL - rest.commHeightR), 'mm', {
    L: rest.commHeightL, R: rest.commHeightR,
  });
  // R03 commissure midline distance diff
  out.R03 = metric(Math.abs(rest.commMidlineDistL - rest.commMidlineDistR), 'mm', {
    L: rest.commMidlineDistL, R: rest.commMidlineDistR,
  });
  // R04 oral tilt angle: angle of the 61→291 line vs HF X-axis (degrees)
  {
    const dx = rest.commLX - rest.commRX;
    const dy = rest.commLY - rest.commRY;
    const angle = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
    out.R04 = metric(angle, 'deg');
  }
  // R06/R07 palpebral fissure height + ratio
  out.R06 = metric(null, 'mm', { L: rest.pfhL, R: rest.pfhR });
  out.R07 = metric(symmetryRatio(rest.pfhL, rest.pfhR), 'ratio', { L: rest.pfhL, R: rest.pfhR });
  // R08/R09 brow height + diff
  out.R08 = metric(null, 'mm', { L: rest.browHeightL, R: rest.browHeightR });
  out.R09 = metric(Math.abs(rest.browHeightL - rest.browHeightR), 'mm', {
    L: rest.browHeightL, R: rest.browHeightR,
  });
  // R12 cheek height diff
  out.R12 = metric(Math.abs(rest.cheekLY - rest.cheekRY), 'mm', { L: rest.cheekLY, R: rest.cheekRY });
  return out;
}

/* ======================================================================
 * S — Smile showing teeth (P5) — FAST core
 * ==================================================================== */

/**
 * @param {object} rest
 * @param {FrameSample[]} p5Buffer
 * @param {object} thr thresholds
 * @param {object} sideMap blendshape side map
 * @returns {Record<string, object>}
 */
export function smileMetrics(rest, p5Buffer, thr, sideMap) {
  const floor = thr.movement_floor_mm.smile_commissure;
  const out = {};
  if (!rest) return { S02: metric(null, 'ratio', { reason: REASON.LOW_QUALITY }) };

  // Driver = mean commissure displacement magnitude (both sides).
  const driver = (p) =>
    (Math.hypot(p.commL.x - rest.commLX, p.commL.y - rest.commLY) +
      Math.hypot(p.commR.x - rest.commRX, p.commR.y - rest.commRY)) / 2;
  const peak = computePeak(p5Buffer, driver);
  if (!peak) return { S02: metric(null, 'ratio', { reason: REASON.NOT_PERFORMED }) };

  // Rest stores no commissure z, so excursion is planar (X,Y) in HF mm.
  const excLmm = Math.hypot(peak.prim.commL.x - rest.commLX, peak.prim.commL.y - rest.commLY);
  const excRmm = Math.hypot(peak.prim.commR.x - rest.commRX, peak.prim.commR.y - rest.commRY);

  out.S01 = metric(null, 'mm', { L: excLmm, R: excRmm });

  if (Math.max(excLmm, excRmm) < floor) {
    out.S02 = metric(null, 'ratio', { L: excLmm, R: excRmm, reason: REASON.BELOW_FLOOR });
  } else {
    out.S02 = metric(symmetryRatio(excLmm, excRmm, floor), 'ratio', { L: excLmm, R: excRmm });
  }
  // S03 signed diff
  out.S03 = metric(excLmm - excRmm, 'mm', { L: excLmm, R: excRmm });

  // S07 smile angle at peak: 61→291 line vs HF X.
  {
    const dx = peak.prim.commL.x - peak.prim.commR.x;
    const dy = peak.prim.commL.y - peak.prim.commR.y;
    out.S07 = metric(Math.abs((Math.atan2(dy, dx) * 180) / Math.PI), 'deg');
  }
  // S08 commissure height diff at peak
  out.S08 = metric(Math.abs(peak.prim.commHeightL - peak.prim.commHeightR), 'mm', {
    L: peak.prim.commHeightL, R: peak.prim.commHeightR,
  });
  // S13 mouth midline shift at peak (rest mouth centre x ≈ 0 in HF)
  out.S13 = metric(Math.abs(peak.prim.mouthCentre.x), 'mm');

  // S14 smile blendshape ratio at peak (model cross-check)
  {
    const frames = peak.frames;
    const smL = avg(frames.map((f) => bs(f.blendshapes, f.bsIndex, sideBsName('mouthSmile', 'L', sideMap))));
    const smR = avg(frames.map((f) => bs(f.blendshapes, f.bsIndex, sideBsName('mouthSmile', 'R', sideMap))));
    out.S14 = metric(symmetryRatio(smL, smR, 0.05), 'ratio', { L: smL, R: smR });
  }
  return out;
}

/* ======================================================================
 * B — Brow raise (P2)
 * ==================================================================== */

export function browMetrics(rest, p2Buffer, thr) {
  const floor = thr.movement_floor_mm.brow;
  if (!rest) return { B02: metric(null, 'ratio', { reason: REASON.LOW_QUALITY }) };
  const driver = (p) => ((p.browHeightL - rest.browHeightL) + (p.browHeightR - rest.browHeightR)) / 2;
  const peak = computePeak(p2Buffer, driver);
  if (!peak) return { B02: metric(null, 'ratio', { reason: REASON.NOT_PERFORMED }) };

  const excL = Math.max(0, peak.prim.browHeightL - rest.browHeightL);
  const excR = Math.max(0, peak.prim.browHeightR - rest.browHeightR);
  const out = {};
  out.B01 = metric(null, 'mm', { L: excL, R: excR });
  if (Math.max(excL, excR) < floor) {
    out.B02 = metric(null, 'ratio', { L: excL, R: excR, reason: REASON.BELOW_FLOOR });
  } else {
    out.B02 = metric(symmetryRatio(excL, excR, floor), 'ratio', { L: excL, R: excR });
  }
  out.B03 = metric(excL - excR, 'mm', { L: excL, R: excR });
  return out;
}

/* ======================================================================
 * E — Eye closure (P3 gentle, P4 tight)
 * ==================================================================== */

export function eyeMetrics(rest, p3Buffer, p4Buffer, thr, sideMap) {
  if (!rest) return { E03: metric(null, 'ratio', { reason: REASON.LOW_QUALITY }) };
  const out = {};

  // Minimum PFH during gentle-closure hold = residual gap proxy.
  const gentle = validOnly(p3Buffer);
  if (gentle.length >= 3) {
    const minPfhL = Math.min(...gentle.map((f) => f.prim.pfhL));
    const minPfhR = Math.min(...gentle.map((f) => f.prim.pfhR));
    out.E01 = metric(null, 'mm', { L: minPfhL, R: minPfhR });
    const compL = clamp(1 - minPfhL / rest.pfhL, 0, 1) * 100;
    const compR = clamp(1 - minPfhR / rest.pfhR, 0, 1) * 100;
    out.E02 = metric(null, '%', { L: compL, R: compR });
    out.E03 = metric(symmetryRatio(compL, compR, 1), 'ratio', { L: compL, R: compR });
  } else {
    out.E03 = metric(null, 'ratio', { reason: REASON.NOT_PERFORMED });
  }

  // Tight squeeze ratio from eyeSquint blendshape peaks (P4).
  const tight = validOnly(p4Buffer);
  if (tight.length >= 3) {
    const sqL = Math.max(...tight.map((f) => bs(f.blendshapes, f.bsIndex, sideBsName('eyeSquint', 'L', sideMap))));
    const sqR = Math.max(...tight.map((f) => bs(f.blendshapes, f.bsIndex, sideBsName('eyeSquint', 'R', sideMap))));
    out.E05 = metric(symmetryRatio(sqL, sqR, 0.05), 'ratio', { L: sqL, R: sqR });
  } else {
    out.E05 = metric(null, 'ratio', { reason: REASON.NOT_PERFORMED });
  }
  return out;
}

/* ======================================================================
 * P — Pucker (P6), N — Snarl (P7)
 * ==================================================================== */

export function puckerMetrics(rest, p6Buffer, thr) {
  const floor = thr.movement_floor_mm.pucker;
  if (!rest) return { P02: metric(null, 'ratio', { reason: REASON.LOW_QUALITY }) };
  // Pucker = decrease in |X| of commissure (medial movement).
  const driver = (p) =>
    ((rest.commMidlineDistL - Math.abs(p.commL.x)) + (rest.commMidlineDistR - Math.abs(p.commR.x))) / 2;
  const peak = computePeak(p6Buffer, driver);
  if (!peak) return { P02: metric(null, 'ratio', { reason: REASON.NOT_PERFORMED }) };
  const medL = Math.max(0, rest.commMidlineDistL - Math.abs(peak.prim.commL.x));
  const medR = Math.max(0, rest.commMidlineDistR - Math.abs(peak.prim.commR.x));
  const out = {};
  out.P01 = metric(null, 'mm', { L: medL, R: medR });
  if (Math.max(medL, medR) < floor) {
    out.P02 = metric(null, 'ratio', { L: medL, R: medR, reason: REASON.BELOW_FLOOR });
  } else {
    out.P02 = metric(symmetryRatio(medL, medR, floor), 'ratio', { L: medL, R: medR });
  }
  return out;
}

export function snarlMetrics(rest, p7Buffer, thr) {
  const floor = thr.movement_floor_mm.snarl;
  if (!rest) return { N02: metric(null, 'ratio', { reason: REASON.LOW_QUALITY }) };
  if (!p7Buffer || !validOnly(p7Buffer).length) {
    return { N02: metric(null, 'ratio', { reason: REASON.NOT_PERFORMED }) };
  }
  const driver = (p) => ((rest.lipPeakLY - p.lipPeakL.y) * -1 + (rest.lipPeakRY - p.lipPeakR.y) * -1) / 2;
  const peak = computePeak(p7Buffer, driver);
  if (!peak) return { N02: metric(null, 'ratio', { reason: REASON.NOT_PERFORMED }) };
  const elL = Math.max(0, peak.prim.lipPeakL.y - rest.lipPeakLY);
  const elR = Math.max(0, peak.prim.lipPeakR.y - rest.lipPeakRY);
  const out = {};
  out.N01 = metric(null, 'mm', { L: elL, R: elR });
  if (Math.max(elL, elR) < floor) {
    out.N02 = metric(null, 'ratio', { L: elL, R: elR, reason: REASON.BELOW_FLOOR });
  } else {
    out.N02 = metric(symmetryRatio(elL, elR, floor), 'ratio', { L: elL, R: elR });
  }
  return out;
}

export { metric };
