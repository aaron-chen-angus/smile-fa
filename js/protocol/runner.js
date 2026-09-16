/**
 * SMILE-FA — protocol/runner.js  (T-16, R4)
 *
 * Drives phases P1–P9: phase clock, spoken + on-screen prompt, countdown,
 * per-frame buffering, compliance detection (from blendshapes), repeat-once of
 * non-compliant phases, and pause/resume when a hard quality gate fails.
 *
 * The runner is UI-agnostic: it calls injected callbacks (onPhase, onTick,
 * onInstruction, onComplete) and pulls frames from a provided source loop.
 *
 * @module protocol/runner
 */

import { bs, sideBsName } from '../engine/frameMetrics.js';

/**
 * @typedef {Object} RunnerDeps
 * @property {object} protocol         protocol.json
 * @property {object} thresholds       thresholds.json
 * @property {object} landmarksCfg     landmarks.json (for side_map)
 * @property {(text:string)=>void} speak
 * @property {(t:(k:string)=>string)} t translator
 * @property {(phase:object, idx:number, total:number)=>void} onPhase
 * @property {(remainMs:number, phase:object)=>void} onTick
 * @property {(text:string)=>void} onInstruction
 * @property {(paused:boolean, reason?:string)=>void} onPauseState
 * @property {(buffers:Record<string, object[]>)=>void} onComplete
 * @property {boolean} [assisted] whether optional phases may be skipped
 */

export class ProtocolRunner {
  /** @param {RunnerDeps} deps */
  constructor(deps) {
    this.d = deps;
    this.sideMap = deps.landmarksCfg.blendshapes.side_map;
    /** @type {Record<string, object[]>} per-phase frame buffers */
    this.buffers = {};
    this.phases = deps.protocol.phases.filter((p) => !(p.optional && deps.skipOptional));
    this.idx = -1;
    this.phaseStart = 0;
    this.paused = false;
    this.pausedAccum = 0;
    this.pauseBegan = 0;
    this.repeatUsed = {};
    this.complianceHits = 0;
    this.finished = false;
  }

  /** Begin the protocol at P1. */
  start() {
    this.idx = -1;
    this._advance();
  }

  /** Move to the next phase (or finish). */
  _advance() {
    this.idx += 1;
    if (this.idx >= this.phases.length) {
      this.finished = true;
      this.d.onComplete(this.buffers);
      return;
    }
    const phase = this.phases[this.idx];
    this.buffers[phase.id] = this.buffers[phase.id] || [];
    this.phaseStart = performance.now();
    this.pausedAccum = 0;
    this.complianceHits = 0;
    this.d.onPhase(phase, this.idx, this.phases.length);
    const text = this.d.t(phase.i18n);
    this.d.onInstruction(text);
    this.d.speak(text);
  }

  /** Total duration for the current phase (hold + relax across reps). */
  _phaseDurationMs(phase) {
    const per = (phase.hold_ms || 0) + (phase.relax_ms || 0);
    return per * (phase.repetitions || 1);
  }

  /**
   * Called every frame by the host loop.
   * @param {number} nowMs
   * @param {object} sample { valid, prim, blendshapes, bsIndex } for this frame
   */
  onFrame(nowMs, sample) {
    if (this.finished || this.idx < 0) return;
    const phase = this.phases[this.idx];

    // Pause/resume on hard gate state (R3.3): only pause during timed phases.
    if (!sample.valid) {
      if (!this.paused) {
        this.paused = true;
        this.pauseBegan = nowMs;
        this.d.onPauseState(true, 'quality');
      }
      return; // do not accumulate invalid frames or advance the clock
    }
    if (this.paused) {
      this.paused = false;
      this.pausedAccum += nowMs - this.pauseBegan;
      this.d.onPauseState(false);
    }

    // Buffer valid frame.
    this.buffers[phase.id].push({ tMs: nowMs, ...sample });

    // Compliance detection from blendshapes.
    if (this._checkCompliance(phase, sample)) this.complianceHits += 1;

    // Phase clock (excludes paused time).
    const elapsed = nowMs - this.phaseStart - this.pausedAccum;
    const total = this._phaseDurationMs(phase);
    this.d.onTick(Math.max(0, total - elapsed), phase);

    if (elapsed >= total) this._endPhase(phase);
  }

  /** Compliance check per phase from its blendshape rule (protocol.json). */
  _checkCompliance(phase, sample) {
    const c = phase.compliance;
    if (!c) return true;
    const B = (name) => bs(sample.blendshapes, sample.bsIndex, name);
    if (c.jawOpen_below != null) return B('jawOpen') < c.jawOpen_below;
    if (c.blendshape && c.mean_above != null) {
      const l = B(sideBsName(c.blendshape, 'L', this.sideMap));
      const r = B(sideBsName(c.blendshape, 'R', this.sideMap));
      return (l + r) / 2 > c.mean_above;
    }
    if (c.blendshape && c.either_side_above != null) {
      const l = B(sideBsName(c.blendshape, 'L', this.sideMap));
      const r = B(sideBsName(c.blendshape, 'R', this.sideMap));
      return Math.max(l, r) > c.either_side_above;
    }
    if (c.blendshape && c.max_above != null) {
      const l = B(sideBsName(c.blendshape, 'L', this.sideMap));
      const r = B(sideBsName(c.blendshape, 'R', this.sideMap));
      return Math.max(l, r) > c.max_above;
    }
    if (c.blendshape && c.above != null) {
      // Some categories are unsided (mouthPucker, mouthFunnel, jawOpen); others
      // are only exposed with Left/Right suffixes (e.g. noseSneer). Try the bare
      // name first, then fall back to the max of the sided pair.
      const bare = B(c.blendshape);
      if (bare > 0) return bare > c.above;
      const l = B(sideBsName(c.blendshape, 'L', this.sideMap));
      const r = B(sideBsName(c.blendshape, 'R', this.sideMap));
      return Math.max(l, r) > c.above;
    }
    if (c.expression_happy_above != null) return true; // handled by emotion stream
    return true;
  }

  /**
   * End of a phase: decide compliance, repeat once if needed (R4.2).
   * @param {object} phase
   */
  _endPhase(phase) {
    const frames = this.buffers[phase.id];
    const complianceRatio = frames.length ? this.complianceHits / frames.length : 0;
    const compliant = phase.compliance == null || complianceRatio >= 0.2;

    if (!compliant && !this.repeatUsed[phase.id]) {
      // Repeat this phase once.
      this.repeatUsed[phase.id] = true;
      this.buffers[phase.id] = [];
      this.phaseStart = performance.now();
      this.pausedAccum = 0;
      this.complianceHits = 0;
      const text = `${this.d.t('phase.relax')} — ${this.d.t(phase.i18n)}`;
      this.d.onInstruction(text);
      this.d.speak(this.d.t(phase.i18n));
      return;
    }

    // Mark compliance status on the buffer for downstream reason codes.
    this.buffers[phase.id].compliant = compliant;
    this._advance();
  }

  /** Force stop (e.g. tab hidden / user abort). */
  abort() { this.finished = true; }
}
