/**
 * SMILE-FA — tests/headframe.test.js  (covers T-06, R10.3)
 *
 * Spec-mandated synthetic checks:
 *   - rotated symmetric face → ~zero asymmetry (commissure height diff ≈ 0)
 *   - known 3 mm droop → R02 (commissure_height_diff) = 3 ± 0.2 mm
 *
 * @module tests/headframe.test
 */

import { describe, it, assert, assertClose } from './harness.js';
import { buildHeadFrame, iodMm } from '../engine/headframe.js';
import { makeFace, landmarksCfg as cfg } from './syntheticFace.js';

/** Commissure height diff R02 = |Y_L − Y_R| in HF mm. */
function commissureHeightDiff(hf) {
  const yL = hf.transformIndex(cfg.points.oral_commissure.L).y;
  const yR = hf.transformIndex(cfg.points.oral_commissure.R).y;
  return Math.abs(yL - yR);
}

describe('headframe: mm scale', () => {
  it('recovers IOD ≈ 62 mm from synthetic face', () => {
    const { landmarks, w, h } = makeFace();
    const hf = buildHeadFrame(landmarks, w, h, cfg);
    const iod = iodMm(hf, cfg);
    assertClose(iod, 62, 2.0, `IOD should be ~62 mm, got ${iod.toFixed(2)}`);
  });

  it('mmPerUnit is positive and finite', () => {
    const { landmarks, w, h } = makeFace();
    const hf = buildHeadFrame(landmarks, w, h, cfg);
    assert(hf.mmPerUnit > 0 && Number.isFinite(hf.mmPerUnit), 'mmPerUnit valid');
  });
});

describe('headframe: symmetric face → zero asymmetry', () => {
  it('frontal symmetric face has ~0 commissure height diff', () => {
    const { landmarks, w, h } = makeFace();
    const hf = buildHeadFrame(landmarks, w, h, cfg);
    assertClose(commissureHeightDiff(hf), 0, 0.2, 'symmetric → ~0');
  });

  it('rotated (yaw 12°, pitch 8°, roll 6°) symmetric face still ~0', () => {
    const { landmarks, w, h } = makeFace({ yaw: 12, pitch: 8, roll: 6 });
    const hf = buildHeadFrame(landmarks, w, h, cfg);
    // Head-frame correction should remove pose-induced apparent asymmetry.
    assertClose(commissureHeightDiff(hf), 0, 0.5, 'rotation must not create asymmetry');
  });
});

describe('headframe: known droop', () => {
  it('3 mm patient-LEFT droop → R02 = 3 ± 0.2', () => {
    const { landmarks, w, h } = makeFace({ droopMmL: 3 });
    const hf = buildHeadFrame(landmarks, w, h, cfg);
    assertClose(commissureHeightDiff(hf), 3, 0.2, 'droop magnitude recovered');
  });

  it('droop is detected on the correct (LEFT) side', () => {
    const { landmarks, w, h } = makeFace({ droopMmL: 3 });
    const hf = buildHeadFrame(landmarks, w, h, cfg);
    const yL = hf.transformIndex(cfg.points.oral_commissure.L).y;
    const yR = hf.transformIndex(cfg.points.oral_commissure.R).y;
    assert(yL < yR, 'patient LEFT commissure should sit lower (smaller Y)');
  });

  it('rotated 3 mm droop still ≈ 3 ± 0.4', () => {
    const { landmarks, w, h } = makeFace({ droopMmL: 3, yaw: 10, roll: 5 });
    const hf = buildHeadFrame(landmarks, w, h, cfg);
    assertClose(commissureHeightDiff(hf), 3, 0.4, 'droop robust to pose');
  });
});
