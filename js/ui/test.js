/**
 * SMILE-FA — ui/test.js  (T-16 test screen controller)
 *
 * Runs the S3 test screen: reuses the camera + landmarker from setup, drives the
 * ProtocolRunner, draws the overlay, updates the phase list / countdown ring /
 * quality meter, feeds the emotion sampler, and buffers per-frame samples with
 * quality + primitives for end-of-test analysis.
 *
 * @module ui/test
 */

import { Overlay } from './overlay.js';
import { ProtocolRunner } from '../protocol/runner.js';
import { frameQuality } from '../engine/quality.js';
import { buildHeadFrame } from '../engine/headframe.js';
import { computeFramePrimitives } from '../engine/frameMetrics.js';
import { sampleLuminance } from '../vision/luminance.js';

export class TestController {
  /**
   * @param {object} deps
   * @param {HTMLVideoElement} deps.video
   * @param {HTMLCanvasElement} deps.overlayCanvas
   * @param {import('../camera.js').CameraSource} deps.camera
   * @param {import('../vision/landmarker.js').Landmarker} deps.landmarker
   * @param {object} deps.cfg { landmarks, thresholds, protocol }
   * @param {object} deps.i18n { t }
   * @param {(text:string)=>void} deps.speak
   * @param {boolean} deps.assisted
   * @param {(sample:object)=>void} [deps.onEmotionFrame]
   * @param {(result buffers:object)=>void} deps.onComplete
   */
  constructor(deps) {
    this.d = deps;
    this.overlay = new Overlay(deps.overlayCanvas, deps.cfg.landmarks);
    this._fpsEma = 0;
    this._lastT = -1;
    this.runner = null;
  }

  start() {
    const { video, camera, landmarker, cfg, i18n, speak } = this.d;

    this.runner = new ProtocolRunner({
      protocol: cfg.protocol,
      thresholds: cfg.thresholds,
      landmarksCfg: cfg.landmarks,
      skipOptional: !this.d.assisted, // self-screen skips optional P7/P8
      speak,
      t: i18n.t,
      onPhase: (phase, idx, total) => this._renderPhaseList(phase, idx, total),
      onTick: (remainMs, phase) => this._renderCountdown(remainMs, phase),
      onInstruction: (text) => { const el = document.getElementById('instruction'); if (el) el.textContent = text; this._setPictogram(); },
      onPauseState: (paused, reason) => this._renderPause(paused, reason),
      onComplete: (buffers) => { camera.stop(); this.d.onComplete(buffers); },
    });

    this._buildPhaseList();
    this.runner.start();
    camera.loop((now) => this._onFrame(now));
  }

  _onFrame(now) {
    const { video, landmarker, cfg } = this.d;
    if (this._lastT > 0) {
      const dt = now - this._lastT;
      if (dt > 0) { const fps = 1000 / dt; this._fpsEma = this._fpsEma ? this._fpsEma * 0.85 + fps * 0.15 : fps; }
    }
    this._lastT = now;

    let result;
    try { result = landmarker.detect(video, now); }
    catch { return; }

    const has = result.faceLandmarks && result.faceLandmarks.length > 0;
    const lm = has ? result.faceLandmarks[0] : null;
    this.overlay.sync(video);
    this.overlay.draw(lm);

    if (this.d.onEmotionFrame) this.d.onEmotionFrame({ now, phase: this._currentPhaseId() });

    const pose = has ? landmarker.pose(result) : null;
    const lum = sampleLuminance(video);
    const w = video.videoWidth, h = video.videoHeight;

    let faceWidthPx = 0, iodPx = 0, prim = null, blendshapes = [], bsIndex = landmarker.bsIndex;
    if (has) {
      const tr = cfg.landmarks.points.tragion_contour;
      faceWidthPx = Math.hypot((lm[tr.R].x - lm[tr.L].x) * w, (lm[tr.R].y - lm[tr.L].y) * h);
      const irisR = cfg.landmarks.points.iris_centre.R, irisL = cfg.landmarks.points.iris_centre.L;
      iodPx = Math.hypot((lm[irisR].x - lm[irisL].x) * w, (lm[irisR].y - lm[irisL].y) * h);
      const hf = buildHeadFrame(lm, w, h, cfg.landmarks);
      blendshapes = landmarker.blendshapeArray(result);
      prim = computeFramePrimitives(hf, cfg.landmarks, blendshapes, bsIndex);
    }

    const q = frameQuality({
      faceDetected: has,
      faceCount: has ? result.faceLandmarks.length : 0,
      yawDeg: pose ? pose.yaw : 90,
      pitchDeg: pose ? pose.pitch : 90,
      rollDeg: pose ? pose.roll : 90,
      faceWidthPx, iodPx,
      luminanceMean: lum.mean,
      lightingSideRatio: lum.sideRatio,
      fps: this._fpsEma || 30,
      occlusion: false,
    }, cfg.thresholds);

    this._renderQuality(q);

    if (this.runner) {
      this.runner.onFrame(now, {
        valid: q.valid && has,
        prim,
        blendshapes,
        bsIndex,
        q: q.values, // stored for Q17 aggregate
      });
    }
  }

  _currentPhaseId() {
    if (!this.runner || this.runner.idx < 0) return null;
    return this.runner.phases[this.runner.idx]?.id ?? null;
  }

  _buildPhaseList() {
    const ol = document.getElementById('phase-list');
    if (!ol) return;
    ol.innerHTML = '';
    for (const p of this.runner.phases) {
      const li = document.createElement('li');
      li.dataset.phase = p.id;
      li.textContent = this.d.i18n.t(p.i18n);
      ol.appendChild(li);
    }
  }

  _renderPhaseList(phase, idx) {
    document.querySelectorAll('#phase-list li').forEach((li, i) => {
      li.classList.toggle('is-active', i === idx);
      li.classList.toggle('is-done', i < idx);
    });
  }

  _renderCountdown(remainMs, phase) {
    const ring = document.getElementById('countdown-ring');
    if (ring) ring.textContent = String(Math.ceil(remainMs / 1000));
  }

  _renderPause(paused, reason) {
    const el = document.getElementById('instruction');
    if (el && paused) el.textContent = '⏸ ' + this.d.i18n.t('gate.lighting');
  }

  _renderQuality(q) {
    const fill = document.getElementById('quality-fill');
    if (!fill) return;
    // Rough live quality proxy: fraction of gates passing.
    const total = 6;
    const bad = new Set([...q.hardFails, ...q.warns]).size;
    const pct = Math.max(0, Math.round(((total - bad) / total) * 100));
    fill.style.width = pct + '%';
    fill.style.background = pct > 75 ? 'var(--green)' : pct > 50 ? 'var(--amber)' : 'var(--red)';
  }

  _setPictogram() {
    const img = document.getElementById('pictogram');
    if (!img) return;
    const id = this._currentPhaseId();
    const map = { P1: 'rest', P2: 'brow', P3: 'eye', P4: 'eye', P5: 'smile', P6: 'pucker', P7: 'snarl', P8: 'smile', P9: 'rest' };
    const name = map[id] || 'rest';
    img.src = `assets/pictograms/${name}.svg`;
  }
}
