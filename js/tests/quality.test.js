/**
 * SMILE-FA — tests/quality.test.js  (covers T-07)
 * @module tests/quality.test
 */

import { describe, it, assert, assertClose, assertEqual } from './harness.js';
import {
  frameQuality, validFramePct, repetitionCV,
  measurementQualityScore, lightingSideRatio,
} from '../engine/quality.js';
import thr from './thresholdsFixture.js';

const goodFrame = {
  faceDetected: true, faceCount: 1, yawDeg: 2, pitchDeg: 1, rollDeg: 1,
  faceWidthPx: 300, iodPx: 120, luminanceMean: 140, lightingSideRatio: 0.95,
  sharpness: 100, fps: 30, occlusion: false,
};

describe('quality: per-frame gates', () => {
  it('a good frame is valid with no fails/warns', () => {
    const q = frameQuality(goodFrame, thr);
    assert(q.valid, 'should be valid');
    assertEqual(q.hardFails.length, 0);
    assertEqual(q.warns.length, 0);
  });

  it('excessive yaw is a hard fail', () => {
    const q = frameQuality({ ...goodFrame, yawDeg: 20 }, thr);
    assert(!q.valid);
    assert(q.hardFails.includes('Q03'));
  });

  it('side lighting imbalance (Q09) hard-fails below 0.70 (D3)', () => {
    const q = frameQuality({ ...goodFrame, lightingSideRatio: 0.6 }, thr);
    assert(!q.valid);
    assert(q.hardFails.includes('Q09'));
  });

  it('mild lighting imbalance warns between 0.70 and 0.85', () => {
    const q = frameQuality({ ...goodFrame, lightingSideRatio: 0.8 }, thr);
    assert(q.valid, 'still valid (warn only)');
    assert(q.warns.includes('Q09'));
  });

  it('two faces hard-fails Q02', () => {
    const q = frameQuality({ ...goodFrame, faceCount: 2 }, thr);
    assert(q.hardFails.includes('Q02'));
  });

  it('low fps hard-fails below 12', () => {
    const q = frameQuality({ ...goodFrame, fps: 10 }, thr);
    assert(q.hardFails.includes('Q12'));
  });
});

describe('quality: aggregates', () => {
  it('validFramePct', () => {
    const frames = [{ valid: true }, { valid: true }, { valid: false }, { valid: true }];
    assertClose(validFramePct(frames), 75, 1e-9);
  });

  it('repetitionCV is 0 for <2 reps', () => {
    assertEqual(repetitionCV([5]), 0);
  });

  it('repetitionCV computes coefficient of variation', () => {
    // [8,12]: mean 10, sample sd = sqrt(((−2)^2+2^2)/1) = sqrt(8) ≈ 2.828 → CV ≈ 28.28%
    assertClose(repetitionCV([8, 12]), 28.284, 0.1);
  });

  it('lightingSideRatio min/max', () => {
    assertClose(lightingSideRatio(80, 100), 0.8, 1e-9);
  });
});

describe('quality: Q17 score', () => {
  it('ideal session scores high (>85)', () => {
    const agg = { Q03: 1, Q04: 1, Q05: 1, Q06: 320, Q07: 120, Q08: 140, Q09: 0.98, Q10: 120, Q11: 0.1, Q12: 30, Q14: 100, Q16: 5 };
    const s = measurementQualityScore(agg, thr);
    assert(s > 85, `expected >85, got ${s.toFixed(1)}`);
  });

  it('poor session scores low (<60 → unable)', () => {
    const agg = { Q03: 14, Q04: 14, Q05: 18, Q06: 165, Q07: 60, Q08: 65, Q09: 0.71, Q10: 20, Q11: 1.5, Q12: 13, Q14: 55, Q16: 60 };
    const s = measurementQualityScore(agg, thr);
    assert(s < 60, `expected <60, got ${s.toFixed(1)}`);
  });
});
