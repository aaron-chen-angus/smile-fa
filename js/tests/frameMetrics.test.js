/**
 * SMILE-FA — tests/frameMetrics.test.js  (covers T-08)
 * @module tests/frameMetrics.test
 */

import { describe, it, assert, assertClose } from './harness.js';
import { buildHeadFrame, iodMm } from '../engine/headframe.js';
import {
  computeFramePrimitives, globalSymmetryIndex, gsiPairs, sideBsName,
} from '../engine/frameMetrics.js';
import { makeFace, landmarksCfg as cfg } from './syntheticFace.js';

describe('frameMetrics: primitives', () => {
  it('symmetric face → equal PFH and brow heights L/R', () => {
    const { landmarks, w, h } = makeFace();
    const hf = buildHeadFrame(landmarks, w, h, cfg);
    const p = computeFramePrimitives(hf, cfg);
    assertClose(p.pfhL, p.pfhR, 0.2, 'PFH symmetric');
    assertClose(p.browHeightL, p.browHeightR, 0.3, 'brow height symmetric');
  });

  it('commissure heights equal for symmetric face', () => {
    const { landmarks, w, h } = makeFace();
    const hf = buildHeadFrame(landmarks, w, h, cfg);
    const p = computeFramePrimitives(hf, cfg);
    assertClose(p.commHeightL, p.commHeightR, 0.2);
  });

  it('LEFT droop lowers LEFT commissure height', () => {
    const { landmarks, w, h } = makeFace({ droopMmL: 4 });
    const hf = buildHeadFrame(landmarks, w, h, cfg);
    const p = computeFramePrimitives(hf, cfg);
    assert(p.commHeightL < p.commHeightR, 'left lower');
    assertClose(Math.abs(p.commHeightL - p.commHeightR), 4, 0.3);
  });
});

describe('frameMetrics: GSI', () => {
  it('symmetric face GSI ≈ 0 %IOD', () => {
    const { landmarks, w, h } = makeFace();
    const hf = buildHeadFrame(landmarks, w, h, cfg);
    const T = (i) => hf.transformIndex(i);
    const gsi = globalSymmetryIndex(T, gsiPairs(cfg).all, iodMm(hf, cfg));
    assertClose(gsi, 0, 1.0, `symmetric GSI should be ~0, got ${gsi.toFixed(2)}`);
  });

  it('droop increases perioral GSI above resting', () => {
    const sym = makeFace();
    const droop = makeFace({ droopMmL: 5 });
    const hfSym = buildHeadFrame(sym.landmarks, sym.w, sym.h, cfg);
    const hfDroop = buildHeadFrame(droop.landmarks, droop.w, droop.h, cfg);
    const gsiSym = globalSymmetryIndex((i) => hfSym.transformIndex(i), gsiPairs(cfg).perioral, iodMm(hfSym, cfg));
    const gsiDroop = globalSymmetryIndex((i) => hfDroop.transformIndex(i), gsiPairs(cfg).perioral, iodMm(hfDroop, cfg));
    assert(gsiDroop > gsiSym + 1, `droop GSI (${gsiDroop.toFixed(2)}) should exceed symmetric (${gsiSym.toFixed(2)})`);
  });
});

describe('frameMetrics: side blendshape naming', () => {
  it('maps patient side to MediaPipe suffix via side_map', () => {
    const map = { patient_L: 'left', patient_R: 'right' };
    assert(sideBsName('mouthSmile', 'L', map) === 'mouthSmileLeft');
    assert(sideBsName('mouthSmile', 'R', map) === 'mouthSmileRight');
  });
});
