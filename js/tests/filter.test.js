/**
 * SMILE-FA — tests/filter.test.js  (covers T-05)
 * @module tests/filter.test
 */

import { describe, it, assert, assertClose } from './harness.js';
import { OneEuroFilter, OneEuroVec3, LandmarkFilter } from '../engine/filter.js';
import { avg } from '../engine/vec.js';

describe('OneEuroFilter', () => {
  it('passes a constant signal through unchanged (steady state)', () => {
    const f = new OneEuroFilter();
    let y = 0;
    for (let i = 0; i < 60; i++) y = f.filter(5.0, i / 60);
    assertClose(y, 5.0, 1e-6, 'constant should converge to itself');
  });

  it('reduces variance of a noisy constant signal', () => {
    const f = new OneEuroFilter({ minCutoff: 0.5, beta: 0.001 });
    const raw = [];
    const filtered = [];
    let seed = 42;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff - 0.5; };
    for (let i = 0; i < 200; i++) {
      const noisy = 10 + rnd() * 2; // ±1 noise around 10
      raw.push(noisy);
      filtered.push(f.filter(noisy, i / 60));
    }
    // Compare variance over the settled tail.
    const tail = (arr) => arr.slice(100);
    const varOf = (arr) => { const m = avg(arr); return avg(arr.map((x) => (x - m) ** 2)); };
    assert(varOf(tail(filtered)) < varOf(tail(raw)), 'filtered variance should be lower than raw');
  });

  it('tracks a ramp with bounded lag', () => {
    const f = new OneEuroFilter({ minCutoff: 1.0, beta: 0.02 });
    let y = 0;
    for (let i = 0; i < 120; i++) y = f.filter(i * 0.1, i / 60); // slope 0.1/frame
    // After 120 frames the true value is ~11.9; filtered should be close.
    assertClose(y, 11.9, 1.0, 'ramp tracking lag should be bounded');
  });

  it('reset() clears state', () => {
    const f = new OneEuroFilter();
    f.filter(100, 0); f.filter(100, 1 / 60);
    f.reset();
    const y = f.filter(3, 0);
    assertClose(y, 3, 1e-6, 'after reset the first sample passes through');
  });
});

describe('OneEuroVec3 + LandmarkFilter', () => {
  it('filters each axis independently', () => {
    const f = new OneEuroVec3();
    let p = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 60; i++) p = f.filter({ x: 1, y: 2, z: 3 }, i / 60);
    assertClose(p.x, 1, 1e-6);
    assertClose(p.y, 2, 1e-6);
    assertClose(p.z, 3, 1e-6);
  });

  it('LandmarkFilter keeps per-index state and returns same length', () => {
    const lf = new LandmarkFilter();
    const frame = [{ x: 0, y: 0, z: 0 }, { x: 10, y: 10, z: 10 }];
    let out;
    for (let i = 0; i < 30; i++) out = lf.filter(frame, i / 60);
    assert(out.length === 2, 'length preserved');
    assertClose(out[1].x, 10, 1e-3, 'second landmark converges independently');
  });
});
