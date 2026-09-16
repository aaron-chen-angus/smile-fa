/**
 * SMILE-FA — vision/emotion.js  (T-18, R6.1)
 *
 * face-api FaceExpressionNet sampler running in parallel with landmarking.
 * Samples at 5 Hz by default and drops to 2.5 Hz adaptively if landmark fps is
 * low (design.md §2). Emotion NEVER feeds asymmetry scores (D5) — it is a
 * synchronised, labelled stream only.
 *
 * Degrades gracefully: if face-api fails to load, isReady() stays false and
 * the sampler is a no-op so the test still runs.
 *
 * @module vision/emotion
 */

import { loadFaceApi } from '../loader.js';

export const EXPRESSIONS = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'];

export class EmotionSampler {
  /** @param {HTMLVideoElement} video */
  constructor(video) {
    this.video = video;
    this.faceapi = null;
    this.ready = false;
    this.intervalMs = 200;      // 5 Hz
    this.lastSampleT = 0;
    this.busy = false;
    /** @type {Array<{tMs:number, phase:string, p:number[]}>} */
    this.series = [];
    this.onSample = null;
  }

  isReady() { return this.ready; }

  /** Load face-api models. Safe to await; sets ready=false on failure. */
  async init() {
    try {
      const { faceapi, modelUrl } = await loadFaceApi();
      this.faceapi = faceapi;
      await faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl);
      await faceapi.nets.faceExpressionNet.loadFromUri(modelUrl);
      this.ready = true;
    } catch (err) {
      console.warn('[emotion] face-api unavailable; emotion stream disabled', err);
      this.ready = false;
    }
  }

  /** Adapt sampling rate from measured landmark fps (design.md §2). */
  setLandmarkFps(fps) {
    this.intervalMs = fps < 18 ? 400 : 200; // drop to 2.5 Hz when slow
  }

  /**
   * Call every landmark frame; internally throttles to the sample interval.
   * @param {number} nowMs
   * @param {string} phase current phase id
   */
  async maybeSample(nowMs, phase) {
    if (!this.ready || this.busy) return;
    if (nowMs - this.lastSampleT < this.intervalMs) return;
    this.lastSampleT = nowMs;
    this.busy = true;
    try {
      const opts = new this.faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
      const det = await this.faceapi.detectSingleFace(this.video, opts).withFaceExpressions();
      if (det && det.expressions) {
        const p = EXPRESSIONS.map((e) => det.expressions[e] ?? 0);
        const sample = { tMs: nowMs, phase, p };
        this.series.push(sample);
        if (this.onSample) this.onSample(sample);
      }
    } catch {
      /* ignore transient detection errors */
    } finally {
      this.busy = false;
    }
  }

  /** Phase-mean of each expression (X12) and dominant %s (X13). */
  summary() {
    const byPhase = {};
    for (const s of this.series) {
      (byPhase[s.phase] = byPhase[s.phase] || []).push(s.p);
    }
    const X12 = {}, X13 = {};
    for (const [phase, arr] of Object.entries(byPhase)) {
      const means = EXPRESSIONS.map((_, i) => arr.reduce((a, p) => a + p[i], 0) / arr.length);
      X12[phase] = Object.fromEntries(EXPRESSIONS.map((e, i) => [e, means[i]]));
      const counts = {};
      for (const p of arr) {
        const dom = EXPRESSIONS[p.indexOf(Math.max(...p))];
        counts[dom] = (counts[dom] || 0) + 1;
      }
      X13[phase] = Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, (v / arr.length) * 100]));
    }
    return { X12, X13, series: this.series };
  }
}
