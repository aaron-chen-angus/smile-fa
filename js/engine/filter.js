/**
 * SMILE-FA — engine/filter.js  (T-05)
 *
 * One Euro filter (Casiez et al., 2012) for low-latency landmark smoothing
 * (R5.2). Pure, DOM-free, configurable. Provides:
 *   - OneEuroFilter: single scalar signal
 *   - OneEuroVec3: a {x,y,z} point
 *   - LandmarkFilter: an array of {x,y,z} landmarks (one filter per axis per point)
 *
 * The filter adapts its cutoff to signal speed: low speed → strong smoothing
 * (less jitter), high speed → light smoothing (less lag).
 *
 * @module engine/filter
 */

/** Low-pass filter with exponential smoothing. */
class LowPass {
  constructor() {
    /** @type {number|null} */
    this.y = null;
    /** @type {number|null} */
    this.s = null;
  }
  /**
   * @param {number} value
   * @param {number} alpha smoothing factor in (0,1]
   * @returns {number}
   */
  filter(value, alpha) {
    this.y = value;
    this.s = this.s === null ? value : alpha * value + (1 - alpha) * this.s;
    return this.s;
  }
  hasLast() { return this.s !== null; }
  last() { return this.s; }
  reset() { this.y = null; this.s = null; }
}

/**
 * @typedef {Object} OneEuroConfig
 * @property {number} [minCutoff=1.0] minimum cutoff frequency (Hz); lower = smoother at rest
 * @property {number} [beta=0.007]    speed coefficient; higher = less lag on fast motion
 * @property {number} [dCutoff=1.0]   cutoff for the derivative
 */

/** @type {Required<OneEuroConfig>} */
export const DEFAULT_ONE_EURO = { minCutoff: 1.0, beta: 0.007, dCutoff: 1.0 };

/** Smoothing factor from cutoff frequency and sample period. */
function alpha(cutoff, dt) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

/** One Euro filter for a single scalar. */
export class OneEuroFilter {
  /** @param {OneEuroConfig} [cfg] */
  constructor(cfg = {}) {
    this.minCutoff = cfg.minCutoff ?? DEFAULT_ONE_EURO.minCutoff;
    this.beta = cfg.beta ?? DEFAULT_ONE_EURO.beta;
    this.dCutoff = cfg.dCutoff ?? DEFAULT_ONE_EURO.dCutoff;
    this.xLow = new LowPass();
    this.dxLow = new LowPass();
    /** @type {number|null} */
    this.lastTimeS = null;
  }

  /**
   * @param {number} value  raw sample
   * @param {number} tSec   timestamp in SECONDS (monotonic)
   * @returns {number} filtered value
   */
  filter(value, tSec) {
    let dt = 1 / 60; // sensible default before we have two samples
    if (this.lastTimeS !== null && tSec > this.lastTimeS) {
      dt = tSec - this.lastTimeS;
    }
    this.lastTimeS = tSec;

    const dxRaw = this.xLow.hasLast() ? (value - this.xLow.last()) / dt : 0;
    const dxHat = this.dxLow.filter(dxRaw, alpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    return this.xLow.filter(value, alpha(cutoff, dt));
  }

  reset() { this.xLow.reset(); this.dxLow.reset(); this.lastTimeS = null; }
}

/** One Euro filter for a {x,y,z} point (independent per axis). */
export class OneEuroVec3 {
  /** @param {OneEuroConfig} [cfg] */
  constructor(cfg = {}) {
    this.fx = new OneEuroFilter(cfg);
    this.fy = new OneEuroFilter(cfg);
    this.fz = new OneEuroFilter(cfg);
  }
  /**
   * @param {{x:number,y:number,z:number}} p
   * @param {number} tSec
   * @returns {{x:number,y:number,z:number}}
   */
  filter(p, tSec) {
    return {
      x: this.fx.filter(p.x, tSec),
      y: this.fy.filter(p.y, tSec),
      z: this.fz.filter(p.z ?? 0, tSec),
    };
  }
  reset() { this.fx.reset(); this.fy.reset(); this.fz.reset(); }
}

/**
 * Filter a whole landmark array, lazily allocating one OneEuroVec3 per index.
 * Reuses state across frames so smoothing is temporal.
 */
export class LandmarkFilter {
  /** @param {OneEuroConfig} [cfg] */
  constructor(cfg = {}) {
    this.cfg = cfg;
    /** @type {OneEuroVec3[]} */
    this.filters = [];
  }

  /**
   * @param {Array<{x:number,y:number,z:number}>} landmarks
   * @param {number} tSec timestamp in seconds
   * @returns {Array<{x:number,y:number,z:number}>} new filtered array
   */
  filter(landmarks, tSec) {
    const out = new Array(landmarks.length);
    for (let i = 0; i < landmarks.length; i++) {
      if (!this.filters[i]) this.filters[i] = new OneEuroVec3(this.cfg);
      out[i] = this.filters[i].filter(landmarks[i], tSec);
    }
    return out;
  }

  reset() { this.filters = []; }
}
