/**
 * SMILE-FA — engine/vec.js
 *
 * Tiny 3D vector + stats helpers shared across the engine. Pure functions,
 * no DOM (tech.md: engine must be DOM-free and portable to Dart).
 *
 * A "point" is { x, y, z }. MediaPipe landmarks are { x, y, z } in normalised
 * image coordinates; convert to isotropic units before geometry (see headframe).
 *
 * @module engine/vec
 */

/** @typedef {{x:number, y:number, z:number}} Vec3 */

/** @param {Vec3} a @param {Vec3} b @returns {Vec3} */
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
/** @param {Vec3} a @param {Vec3} b @returns {Vec3} */
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
/** @param {Vec3} a @param {number} s @returns {Vec3} */
export const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
/** @param {Vec3} a @param {Vec3} b @returns {number} */
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

/** @param {Vec3} a @param {Vec3} b @returns {Vec3} cross product a×b */
export const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

/** @param {Vec3} a @returns {number} Euclidean length */
export const norm = (a) => Math.hypot(a.x, a.y, a.z);

/** @param {Vec3} a @returns {Vec3} unit vector (returns zero vector if length 0) */
export function normalize(a) {
  const n = norm(a);
  return n > 1e-9 ? { x: a.x / n, y: a.y / n, z: a.z / n } : { x: 0, y: 0, z: 0 };
}

/** @param {Vec3} a @param {Vec3} b @returns {number} distance */
export const dist = (a, b) => norm(sub(a, b));

/** @param {Vec3[]} pts @returns {Vec3} centroid */
export function mean(pts) {
  const s = pts.reduce((acc, p) => add(acc, p), { x: 0, y: 0, z: 0 });
  return scale(s, 1 / pts.length);
}

/**
 * Median of a numeric array (returns NaN for empty).
 * @param {number[]} arr
 * @returns {number}
 */
export function median(arr) {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * p-th percentile (0..100) with linear interpolation.
 * @param {number[]} arr
 * @param {number} p
 * @returns {number}
 */
export function percentile(arr, p) {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  if (s.length === 1) return s[0];
  const rank = (p / 100) * (s.length - 1);
  const lo = Math.floor(rank), hi = Math.ceil(rank);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (rank - lo);
}

/** @param {number[]} arr @returns {number} arithmetic mean (NaN if empty) */
export function avg(arr) {
  if (!arr.length) return NaN;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** @param {number[]} arr @returns {number} sample standard deviation */
export function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = avg(arr);
  const v = arr.reduce((acc, x) => acc + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
}

/**
 * Symmetry ratio SR(a,b) = min/max, 1 = perfect symmetry (Data Dictionary §0).
 * Returns null if max < floor (undefined per spec).
 * @param {number} a
 * @param {number} b
 * @param {number} [floor=0]
 * @returns {number|null}
 */
export function symmetryRatio(a, b, floor = 0) {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (hi < floor || hi <= 0) return null;
  return lo / hi;
}

/** Clamp x to [lo, hi]. */
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
