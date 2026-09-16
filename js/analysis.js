/**
 * SMILE-FA — analysis.js
 *
 * End-of-test orchestrator: takes the per-phase frame buffers, computes rest,
 * runs all phase-metric groups, attaches flags, computes composites and Q17,
 * and returns a session result object (schema §J-ish).
 *
 * @module analysis
 */

import { computeRest, restMetrics, smileMetrics, browMetrics, eyeMetrics, puckerMetrics, snarlMetrics } from './engine/phaseMetrics.js';
import { attachFlags, computeComposites } from './engine/composites.js';
import { measurementQualityScore, validFramePct } from './engine/quality.js';
import { avg } from './engine/vec.js';

/**
 * @param {Record<string, object[]>} buffers per-phase frame buffers
 * @param {object} cfg configs { landmarks, thresholds, protocol }
 * @param {object} [meta] session meta (m10, m11, mode, lang)
 * @returns {object} session result
 */
export function analyzeSession(buffers, cfg, meta = {}) {
  const thr = cfg.thresholds;
  const sideMap = cfg.landmarks.blendshapes.side_map;

  const p1 = buffers.P1 || [];
  const rest = computeRest(p1);

  // Metric groups.
  const metrics = {
    ...restMetrics(rest),
    ...browMetrics(rest, buffers.P2 || [], thr),
    ...eyeMetrics(rest, buffers.P3 || [], buffers.P4 || [], thr, sideMap),
    ...smileMetrics(rest, buffers.P5 || [], thr, sideMap),
    ...puckerMetrics(rest, buffers.P6 || [], thr),
    ...snarlMetrics(rest, buffers.P7 || [], thr),
  };

  attachFlags(metrics, thr);

  // Phase validity (Q14) → P1/P5 validity for the indicator.
  const phaseValid = {};
  for (const [id, buf] of Object.entries(buffers)) {
    const frames = Array.isArray(buf) ? buf : [];
    phaseValid[id] = validFramePct(frames.map((f) => ({ valid: f.valid !== false }))) >= thr.quality_gates.Q14_valid_frame_pct.phase_invalid_below;
  }

  // Aggregate quality dimensions for Q17 (session medians of what we tracked).
  const allFrames = Object.values(buffers).flat().filter((f) => f && typeof f === 'object');
  const q17Agg = buildQ17Aggregate(allFrames);
  const q17 = measurementQualityScore(q17Agg, thr);

  const composites = computeComposites(metrics, thr, {
    q17,
    p1Valid: rest != null && phaseValid.P1 !== false,
    p5Valid: phaseValid.P5 !== false,
    baselineZ: meta.baselineZ ?? null,
  });

  return {
    meta: {
      // Participant identity (M02/M03/A-series). Name stays on-device only.
      participantName: meta.participantName ?? '',
      gender: meta.gender ?? null,
      yearOfBirth: meta.yearOfBirth ?? null,           // year only — never full DOB
      M03: meta.M03 ?? new Date().toISOString(),        // test-start, ISO 8601 + offset
      timestamp: meta.M03 ?? new Date().toISOString(),  // alias kept for existing consumers
      thresholds_version: thr.thresholds_version,
      mode: meta.mode ?? 'self_screen',
      lang: meta.lang ?? 'en',
      m10: meta.m10 ?? 'none',
      m11: meta.m11 ?? [],
    },
    quality: { Q17: Math.round(q17), phaseValid },
    metrics,
    composites,
  };
}

/**
 * Build the aggregate object measurementQualityScore expects, from whatever
 * per-frame quality values we captured (frames may carry a `q` object).
 * @param {object[]} frames
 * @returns {object}
 */
function buildQ17Aggregate(frames) {
  const qvals = frames.map((f) => f.q).filter(Boolean);
  if (!qvals.length) {
    // Fallback: assume decent quality if we got frames at all.
    return { Q03: 5, Q04: 5, Q05: 5, Q06: 260, Q07: 110, Q08: 140, Q09: 0.9, Q10: 90, Q11: 0.3, Q12: 25, Q14: 90, Q16: 10 };
  }
  const med = (sel) => avg(qvals.map(sel));
  return {
    Q03: med((q) => Math.abs(q.Q03 ?? 0)),
    Q04: med((q) => Math.abs(q.Q04 ?? 0)),
    Q05: med((q) => Math.abs(q.Q05 ?? 0)),
    Q06: med((q) => q.Q06 ?? 0),
    Q07: med((q) => q.Q07 ?? 0),
    Q08: med((q) => q.Q08 ?? 0),
    Q09: med((q) => q.Q09 ?? 0),
    Q10: med((q) => q.Q10 ?? 0),
    Q11: 0.3,
    Q12: med((q) => q.Q12 ?? 0),
    Q14: 90,
    Q16: 10,
  };
}
