/**
 * SMILE-FA — tests/vec.test.js
 * @module tests/vec.test
 */

import { describe, it, assert, assertClose, assertEqual, assertNull } from './harness.js';
import {
  sub, add, dot, cross, norm, normalize, dist, mean,
  median, percentile, avg, stddev, symmetryRatio, clamp,
} from '../engine/vec.js';

describe('vec: basic ops', () => {
  it('sub/add/dot', () => {
    assertEqual(dot({ x: 1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }), 1);
    const d = sub({ x: 3, y: 3, z: 3 }, { x: 1, y: 1, z: 1 });
    assertEqual(d.x, 2); assertEqual(d.y, 2); assertEqual(d.z, 2);
  });
  it('cross product is orthogonal', () => {
    const c = cross({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    assertClose(c.z, 1, 1e-9);
  });
  it('norm / normalize / dist', () => {
    assertClose(norm({ x: 3, y: 4, z: 0 }), 5, 1e-9);
    const u = normalize({ x: 0, y: 5, z: 0 });
    assertClose(u.y, 1, 1e-9);
    assertClose(dist({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 2 }), 2, 1e-9);
  });
  it('mean centroid', () => {
    const m = mean([{ x: 0, y: 0, z: 0 }, { x: 2, y: 4, z: 6 }]);
    assertClose(m.x, 1, 1e-9); assertClose(m.y, 2, 1e-9); assertClose(m.z, 3, 1e-9);
  });
});

describe('vec: stats', () => {
  it('median odd/even', () => {
    assertEqual(median([3, 1, 2]), 2);
    assertEqual(median([1, 2, 3, 4]), 2.5);
  });
  it('percentile interpolates', () => {
    assertClose(percentile([0, 10], 50), 5, 1e-9);
    assertClose(percentile([0, 1, 2, 3, 4], 95), 3.8, 1e-9);
  });
  it('avg / stddev', () => {
    assertClose(avg([2, 4, 6]), 4, 1e-9);
    assertClose(stddev([2, 4, 6]), 2, 1e-9);
  });
});

describe('vec: symmetryRatio', () => {
  it('perfect symmetry = 1', () => {
    assertClose(symmetryRatio(5, 5), 1, 1e-9);
  });
  it('half = 0.5', () => {
    assertClose(symmetryRatio(5, 10), 0.5, 1e-9);
  });
  it('below floor returns null', () => {
    assertNull(symmetryRatio(1, 2, 3), 'max 2 < floor 3 → null');
  });
  it('clamp', () => {
    assertEqual(clamp(5, 0, 3), 3);
    assertEqual(clamp(-1, 0, 3), 0);
  });
});
