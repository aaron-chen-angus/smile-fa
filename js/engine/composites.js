/**
 * SMILE-FA — engine/composites.js  (T-11, R5.5)
 *
 * Composite scores C01–C12 and flag attachment, all driven by
 * config/thresholds.json (never hard-coded, D4). Pure, DOM-free.
 *
 * Input: a flat map of metric results { id: {value, unit, L, R, flag, reason} }
 * from phaseMetrics. Output: composites + a flags[] list (C12).
 *
 * @module engine/composites
 */

import { clamp } from './vec.js';

/**
 * Attach a flag (none/border/sig) to a ratio-type metric where LOWER is worse.
 * @param {object} m metric result (mutated: flag set)
 * @param {{border_below?:number, sig_below?:number}} band
 */
function flagRatioBelow(m, band) {
  if (m == null || m.value == null || !band) return m;
  if (band.sig_below != null && m.value < band.sig_below) m.flag = 'sig';
  else if (band.border_below != null && m.value < band.border_below) m.flag = 'border';
  else m.flag = 'none';
  return m;
}

/**
 * Attach a flag to a magnitude-type metric where HIGHER is worse.
 * @param {object} m
 * @param {{border?:number, sig?:number, border_above?:number, sig_above?:number}} band
 */
function flagMagnitude(m, band) {
  if (m == null || m.value == null || !band) return m;
  const border = band.border ?? band.border_above;
  const sig = band.sig ?? band.sig_above;
  if (sig != null && m.value >= sig) m.flag = 'sig';
  else if (border != null && m.value >= border) m.flag = 'border';
  else m.flag = 'none';
  return m;
}

/**
 * Attach flags to all known metrics using thresholds.metrics bands.
 * Chooses ratio-vs-magnitude by band shape.
 * @param {Record<string, object>} metrics
 * @param {object} thr
 * @returns {Record<string, object>} same object, flags set
 */
export function attachFlags(metrics, thr) {
  const bands = thr.metrics;
  const byId = {
    R02: 'R02_commissure_height_diff_mm',
    R04: 'R04_oral_tilt_angle_deg',
    R07: 'R07_palpebral_fissure_ratio',
    R09: 'R09_brow_height_diff_mm',
    R13: 'R13_global_symmetry_index_rest_pct',
    B02: 'B02_brow_excursion_ratio',
    E03: 'E03_closure_completeness_ratio',
    E05: 'E05_tight_squeeze_ratio',
    S02: 'S02_commissure_excursion_ratio',
    S07: 'S07_smile_angle_deg',
    S08: 'S08_commissure_height_diff_peak_mm',
    S12: 'S12_dental_show_ratio',
    S14: 'S14_smile_bs_ratio',
    S20: 'S20_global_symmetry_index_smile_pct',
    S21: 'S21_dynamic_asymmetry_gain_pct',
    P02: 'P02_pucker_excursion_ratio',
    N02: 'N02_snarl_ratio',
  };
  for (const [id, bandKey] of Object.entries(byId)) {
    const m = metrics[id];
    const band = bands[bandKey];
    if (!m || !band) continue;
    if ('border_below' in band || 'sig_below' in band) flagRatioBelow(m, band);
    else flagMagnitude(m, band);
  }
  return metrics;
}

/** Normalise a magnitude metric to 0..1 severity (1 = at/over sig). */
function normMagnitude(m, sig) {
  if (m == null || m.value == null || !sig) return 0;
  return clamp(m.value / sig, 0, 1);
}

/** Ratio → asymmetry contribution (1 − ratio), null-safe. */
function ratioAsym(m) {
  if (m == null || m.value == null) return null;
  return clamp(1 - m.value, 0, 1);
}

/**
 * Weighted mean over available (non-null) contributions.
 * @param {Array<{w:number, v:number|null}>} items
 * @returns {number} 0..1
 */
function weightedMean(items) {
  let ws = 0, acc = 0;
  for (const { w, v } of items) {
    if (v == null || Number.isNaN(v)) continue;
    acc += w * v; ws += w;
  }
  return ws > 0 ? acc / ws : 0;
}

/**
 * Compute composites C01–C12.
 *
 * @param {Record<string, object>} m metrics (flags already attached)
 * @param {object} thr thresholds.json
 * @param {object} [opts]
 * @param {number|null} [opts.q17] measurement quality score
 * @param {boolean} [opts.p1Valid=true]
 * @param {boolean} [opts.p5Valid=true]
 * @param {number|null} [opts.baselineZ] max |z| vs baseline (C10)
 * @returns {object} composites C01..C12
 */
export function computeComposites(m, thr, opts = {}) {
  const cw = thr.composites;
  const idxBands = thr.composite_index_bands;

  // C01 UFAI = 100 × (1 − mean(B02, E03, E05))
  const upperItems = [m.B02, m.E03, m.E05].map((x) => (x && x.value != null ? x.value : null)).filter((v) => v != null);
  const UFAI = 100 * (1 - (upperItems.length ? upperItems.reduce((a, b) => a + b, 0) / upperItems.length : 1));

  // C02 LFAI = 100 × (1 − weighted mean of lower-face ratios/norms)
  const w = cw.LFAI_weights;
  const R02norm = m.R02 && m.R02.value != null ? 1 - normMagnitude(m.R02, thr.metrics.R02_commissure_height_diff_mm.sig) : null;
  const R04norm = m.R04 && m.R04.value != null ? 1 - normMagnitude(m.R04, thr.metrics.R04_oral_tilt_angle_deg.sig) : null;
  const lfaiMean = weightedMean([
    { w: w.S02, v: m.S02 && m.S02.value },
    { w: w.S14, v: m.S14 && m.S14.value },
    { w: w.S12, v: m.S12 && m.S12.value },
    { w: w.P02, v: m.P02 && m.P02.value },
    { w: w.N02, v: m.N02 && m.N02.value },
    { w: w.R02_norm, v: R02norm },
    { w: w.R04_norm, v: R04norm },
  ]);
  const LFAI = 100 * (1 - lfaiMean);

  // C03 SMILE-FAI = 0.7·LFAI + 0.3·UFAI
  const SMILE_FAI = cw.SMILE_FAI.LFAI * LFAI + cw.SMILE_FAI.UFAI * UFAI;

  // C04 lower/upper ratio
  const C04 = LFAI / Math.max(UFAI, 5);

  // C06 affected side: majority sign of flagged L/R diffs (S03, B03, P01).
  const sideVotes = [];
  const voteFrom = (metricId, lowerIsWeak = true) => {
    const mm = m[metricId];
    if (!mm || mm.L == null || mm.R == null) return;
    if (Math.abs(mm.L - mm.R) < 1e-6) return;
    // Weaker side = smaller value (less excursion).
    sideVotes.push(mm.L < mm.R ? 'L' : 'R');
  };
  voteFrom('S01'); voteFrom('B01'); voteFrom('P01');
  let affected = 'none';
  if (sideVotes.length) {
    const l = sideVotes.filter((s) => s === 'L').length;
    const r = sideVotes.length - l;
    affected = l === r ? 'unclear' : (l > r ? 'L' : 'R');
  }

  // C05 pattern
  const border = idxBands.border;
  const B02v = m.B02 && m.B02.value != null ? m.B02.value : 1;
  let pattern;
  if (LFAI < border && UFAI < border) {
    pattern = 'none';
    affected = 'none';
  } else if (LFAI >= border && C04 > cw.C05_pattern.central_requires_C04_above && B02v >= cw.C05_pattern.central_requires_B02_min) {
    pattern = 'central';
  } else if (LFAI >= border && UFAI >= border) {
    pattern = 'peripheral';
  } else {
    pattern = 'bilateral_or_indeterminate';
  }

  // C08 NIHSS-4 CV estimate
  const S02v = m.S02 && m.S02.value != null ? m.S02.value : 1;
  const P02v = m.P02 && m.P02.value != null ? m.P02.value : 1;
  const n = cw.C08_nihss4;
  let C08 = 0;
  if (pattern === 'none') C08 = 0;
  else if (S02v < n.level3_S02_below && B02v < n.level3_B02_below) C08 = 3;
  else if (S02v < n.level2_S02_below && P02v < n.level2_P02_below && UFAI < border) C08 = 2;
  else C08 = 1;

  // C09 CPSS analogue
  const C09 = C08 >= 1 ? 'abnormal' : 'normal';

  // C10 baseline change z (passed in)
  const C10 = opts.baselineZ ?? null;

  // C11 indicator
  const p1Valid = opts.p1Valid !== false;
  const p5Valid = opts.p5Valid !== false;
  const q17 = opts.q17 ?? null;
  let indicator;
  if ((q17 != null && q17 < thr.quality_gates.Q17_unable_below) || !p1Valid || !p5Valid) {
    indicator = 'unable';
  } else if (SMILE_FAI >= idxBands.sig || C08 >= 2 || (C10 != null && Math.abs(C10) > cw.C10_baseline_z_sig_abs)) {
    indicator = 'red';
  } else if (SMILE_FAI >= idxBands.border || C08 === 1) {
    indicator = 'amber';
  } else {
    indicator = 'green';
  }

  // C12 flags[]: metric ids exceeding border/sig with values
  const flags = [];
  for (const [id, mm] of Object.entries(m)) {
    if (mm && (mm.flag === 'border' || mm.flag === 'sig')) {
      flags.push({ id, value: mm.value, flag: mm.flag, L: mm.L, R: mm.R });
    }
  }

  return {
    C01_UFAI: round1(UFAI),
    C02_LFAI: round1(LFAI),
    C03_SMILE_FAI: round1(SMILE_FAI),
    C04_lower_upper_ratio: round2(C04),
    C05_pattern: pattern,
    C06_affected_side: affected,
    C08_nihss4_cv: C08,
    C09_cpss_face_cv: C09,
    C10_baseline_z: C10,
    C11_indicator: indicator,
    C12_flags: flags,
  };
}

const round1 = (x) => Math.round(x * 10) / 10;
const round2 = (x) => Math.round(x * 100) / 100;

export { flagRatioBelow, flagMagnitude };
