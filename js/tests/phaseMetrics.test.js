/**
 * SMILE-FA — tests/phaseMetrics.test.js  (covers T-09)
 *
 * Builds synthetic phase buffers from the synthetic face and checks rest/peak
 * extraction, excursion ratios, null/reason codes, and side identification.
 *
 * @module tests/phaseMetrics.test
 */

import { describe, it, assert, assertClose, assertEqual, assertNull } from './harness.js';
import { buildHeadFrame } from '../engine/headframe.js';
import { computeFramePrimitives } from '../engine/frameMetrics.js';
import {
  computeRest, restMetrics, smileMetrics, browMetrics, REASON,
} from '../engine/phaseMetrics.js';
import { makeFace, landmarksCfg as cfg } from './syntheticFace.js';
import thr from './thresholdsFixture.js';

/** Turn a makeFace() options object into one FrameSample. */
function frameFrom(opts, tMs) {
  const { landmarks, w, h } = makeFace(opts);
  const hf = buildHeadFrame(landmarks, w, h, cfg);
  const prim = computeFramePrimitives(hf, cfg, [], {});
  return { tMs, valid: true, prim, blendshapes: [], bsIndex: {} };
}

/** N steady rest frames. */
function restBuffer(n = 10, opts = {}) {
  return Array.from({ length: n }, (_, i) => frameFrom(opts, i * 33));
}

/**
 * A task buffer that ramps a "smile" by widening commissure lateral position.
 * We simulate excursion by moving commissures outward (+lateral) and up.
 * Emulated by adjusting droop negatively is not enough; instead we craft frames
 * with explicit commissure movement via a custom face builder below.
 */
function smileBuffer(exclMm, excrMm, n = 12) {
  // Build frames where commissure moves linearly toward peak in the middle.
  const frames = [];
  for (let i = 0; i < n; i++) {
    const t = Math.sin((i / (n - 1)) * Math.PI); // 0→1→0 over the window
    frames.push(smileFrame(exclMm * t, excrMm * t, i * 33));
  }
  return frames;
}

/** A frame whose LEFT/RIGHT commissures are displaced by given mm (lateral+up). */
function smileFrame(dl, dr, tMs) {
  // Start from symmetric face, then nudge commissures in image space by
  // approximating mm→normalised using the fixture's scale (300px/62mm).
  const { landmarks, w, h } = makeFace();
  const pxPerMm = 300 / 62;
  // Patient LEFT commissure = index 291 (+x side); move it laterally (+x) & up (−imageY).
  const moveOut = (idx, mm, sign) => {
    landmarks[idx] = {
      x: landmarks[idx].x + (sign * mm * pxPerMm) / w,
      y: landmarks[idx].y - (mm * pxPerMm) / h * 0.6,
      z: landmarks[idx].z,
    };
  };
  moveOut(291, dl, +1); // LEFT outward = +x
  moveOut(61, dr, -1);  // RIGHT outward = −x
  const hf = buildHeadFrame(landmarks, w, h, cfg);
  const prim = computeFramePrimitives(hf, cfg, [], {});
  return { tMs, valid: true, prim, blendshapes: [], bsIndex: {} };
}

describe('phaseMetrics: rest extraction', () => {
  it('computeRest returns null with too few valid frames', () => {
    assertNull(computeRest([{ valid: true, prim: {} }]));
  });

  it('rest medians are stable for a steady symmetric face', () => {
    const rest = computeRest(restBuffer(10));
    assert(rest !== null);
    assertClose(rest.commHeightL, rest.commHeightR, 0.2, 'symmetric rest');
  });
});

describe('phaseMetrics: R metrics', () => {
  it('symmetric rest → small R02, R09', () => {
    const rest = computeRest(restBuffer(10));
    const R = restMetrics(rest);
    assertClose(R.R02.value, 0, 0.3);
    assertClose(R.R09.value, 0, 0.3);
  });

  it('LEFT droop rest → R02 reflects the drop and side', () => {
    const rest = computeRest(restBuffer(10, { droopMmL: 3 }));
    const R = restMetrics(rest);
    assertClose(R.R02.value, 3, 0.4);
    assert(R.R02.L < R.R02.R, 'left commissure lower');
  });

  it('low-quality rest (null) → R02 reason low_quality', () => {
    const R = restMetrics(null);
    assertNull(R.R02.value);
    assertEqual(R.R02.reason, REASON.LOW_QUALITY);
  });
});

describe('phaseMetrics: S (smile)', () => {
  it('symmetric big smile → S02 near 1', () => {
    const rest = computeRest(restBuffer(10));
    const S = smileMetrics(rest, smileBuffer(8, 8), thr, cfg.blendshapes.side_map);
    assert(S.S02.value !== null, `S02 should compute, reason=${S.S02.reason}`);
    assert(S.S02.value > 0.85, `symmetric smile ratio high, got ${S.S02.value}`);
  });

  it('asymmetric smile (weak LEFT) → S02 low and side detectable', () => {
    const rest = computeRest(restBuffer(10));
    const S = smileMetrics(rest, smileBuffer(3, 8), thr, cfg.blendshapes.side_map);
    assert(S.S02.value !== null, `S02 should compute, reason=${S.S02.reason}`);
    assert(S.S02.value < 0.7, `weak side lowers ratio, got ${S.S02.value}`);
    assert(S.S01.L < S.S01.R, 'left excursion smaller');
    assert(S.S03.value < 0, 'signed diff negative (L weaker)');
  });

  it('no movement → S02 below_floor null', () => {
    const rest = computeRest(restBuffer(10));
    const S = smileMetrics(rest, restBuffer(12), thr, cfg.blendshapes.side_map);
    assertNull(S.S02.value);
    assertEqual(S.S02.reason, REASON.BELOW_FLOOR);
  });
});

describe('phaseMetrics: B (brow)', () => {
  it('no brow movement → below_floor', () => {
    const rest = computeRest(restBuffer(10));
    const B = browMetrics(rest, restBuffer(10), thr);
    assertNull(B.B02.value);
    assertEqual(B.B02.reason, REASON.BELOW_FLOOR);
  });
});
