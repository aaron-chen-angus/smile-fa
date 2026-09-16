/**
 * SMILE-FA — tests/composites.test.js  (covers T-11)
 * @module tests/composites.test
 */

import { describe, it, assert, assertEqual } from './harness.js';
import { attachFlags, computeComposites } from '../engine/composites.js';
import thr from './thresholdsFixture.js';

/** helper to build a metric result */
const M = (value, L = null, R = null) => ({ value, unit: '', L, R, flag: 'none', reason: null });

/** A healthy, symmetric metric set. */
function healthy() {
  return {
    R02: M(0.5, 10, 10.5), R04: M(1.0),
    B01: M(null, 6, 6), B02: M(0.95, 6, 6),
    E03: M(0.97, 98, 98), E05: M(0.95, 0.8, 0.82),
    S01: M(null, 9, 9), S02: M(0.96, 9, 9), S03: M(0),
    S12: M(0.9), S14: M(0.95, 0.7, 0.72),
    P01: M(null, 4, 4), P02: M(0.9, 4, 4),
    N02: M(0.9),
  };
}

/** Central pattern: weak LEFT lower face, forehead spared (B02 near normal). */
function centralLeft() {
  return {
    R02: M(3.8, 8, 11.8), R04: M(6),
    B01: M(null, 6.0, 6.2), B02: M(0.92, 6.0, 6.2), // forehead spared
    E03: M(0.95, 96, 97), E05: M(0.9, 0.75, 0.78),
    S01: M(null, 3.5, 9.0), S02: M(0.39, 3.5, 9.0), S03: M(-5.5), // LEFT weak
    S12: M(0.5), S14: M(0.45, 0.3, 0.7),
    P01: M(null, 2.0, 4.5), P02: M(0.44, 2.0, 4.5),
    N02: M(0.6),
  };
}

describe('composites: flags', () => {
  it('healthy S02 flagged none, weak S02 flagged sig', () => {
    const h = attachFlags(healthy(), thr);
    assertEqual(h.S02.flag, 'none');
    const c = attachFlags(centralLeft(), thr);
    assertEqual(c.S02.flag, 'sig', 'S02 0.39 < sig_below 0.60');
  });
});

describe('composites: healthy → green/none', () => {
  it('indicator green, pattern none', () => {
    const m = attachFlags(healthy(), thr);
    const c = computeComposites(m, thr, { q17: 90, p1Valid: true, p5Valid: true });
    assertEqual(c.C05_pattern, 'none');
    assertEqual(c.C06_affected_side, 'none');
    assertEqual(c.C11_indicator, 'green');
    assert(c.C03_SMILE_FAI < thr.composite_index_bands.border, 'low FAI');
  });
});

describe('composites: central LEFT weakness', () => {
  it('detects LEFT affected side and elevated FAI', () => {
    const m = attachFlags(centralLeft(), thr);
    const c = computeComposites(m, thr, { q17: 85, p1Valid: true, p5Valid: true });
    assertEqual(c.C06_affected_side, 'L', 'left is weaker across S01/B01/P01 votes');
    assert(c.C03_SMILE_FAI >= thr.composite_index_bands.border, `FAI should be elevated, got ${c.C03_SMILE_FAI}`);
    assert(['amber', 'red'].includes(c.C11_indicator), `indicator amber/red, got ${c.C11_indicator}`);
    assert(c.C12_flags.length > 0, 'flags present');
  });

  it('NIHSS-4 estimate ≥ 1 when asymmetry present', () => {
    const m = attachFlags(centralLeft(), thr);
    const c = computeComposites(m, thr, { q17: 85 });
    assert(c.C08_nihss4_cv >= 1);
    assertEqual(c.C09_cpss_face_cv, 'abnormal');
  });
});

describe('composites: unable', () => {
  it('low Q17 → unable', () => {
    const m = attachFlags(healthy(), thr);
    const c = computeComposites(m, thr, { q17: 40 });
    assertEqual(c.C11_indicator, 'unable');
  });

  it('invalid P5 → unable', () => {
    const m = attachFlags(healthy(), thr);
    const c = computeComposites(m, thr, { q17: 90, p5Valid: false });
    assertEqual(c.C11_indicator, 'unable');
  });
});
