/**
 * SMILE-FA — ui/setup.js  (T-15, R3.1–3.2)
 *
 * S2 setup screen: live camera + face oval + live quality gate checklist.
 * Enables "Begin test" only after all HARD gates pass continuously for the
 * configured hold window (1.5 s).
 *
 * @module ui/setup
 */

import { CameraSource } from '../camera.js';
import { Landmarker } from '../vision/landmarker.js';
import { sampleLuminance } from '../vision/luminance.js';
import { frameQuality } from '../engine/quality.js';
import { buildHeadFrame } from '../engine/headframe.js';

/** Map gate ids in the checklist to the Q-codes that drive them. */
const GATE_MAP = {
  face: ['Q01', 'Q02'],
  distance: ['Q06'],
  pose: ['Q03', 'Q04', 'Q05'],
  lighting: ['Q08'],
  lighting_balance: ['Q09'],
  fps: ['Q12'],
};

export class SetupController {
  /**
   * @param {object} deps
   * @param {HTMLVideoElement} deps.video
   * @param {object} deps.landmarksCfg
   * @param {object} deps.thresholds
   * @param {() => void} deps.onReady called when Begin test is pressed
   */
  constructor({ video, landmarksCfg, thresholds, onReady }) {
    this.video = video;
    this.cfg = landmarksCfg;
    this.thr = thresholds;
    this.onReady = onReady;
    this.camera = new CameraSource(video);
    this.landmarker = new Landmarker();
    this.beginBtn = document.getElementById('btn-begin-test');
    this.gatesPassedSince = null;
    this.active = false;
    this._fpsEma = 0;
    this._lastT = -1;
    // Shared with the test screen once ready.
    this.ready = { camera: this.camera, landmarker: this.landmarker };
  }

  /** Start camera + model + the live gate loop. */
  async start() {
    this.active = true;
    if (!this.landmarker.instance) await this.landmarker.init();

    // Offline mode (T-23 / R10.4): if a video file is chosen, use it as source.
    const fileInput = document.getElementById('video-file');
    if (fileInput) {
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        this.camera.stop();
        await this.camera.startFile(file);
        this.fileMode = true;
      });
    }

    if (!this.camera.stream && !this.fileMode) await this.camera.startCamera();
    if (this.beginBtn) {
      this.beginBtn.disabled = true;
      this.beginBtn.addEventListener('click', () => this._begin(), { once: false });
    }
    this._cancelLoop = this.camera.loop((now) => this._onFrame(now));
  }

  _begin() {
    if (this.beginBtn.disabled) return;
    this.active = false;
    // Cancel the setup frame loop so only the test loop runs after handoff.
    if (this._cancelLoop) this._cancelLoop();
    this.onReady();
  }

  _onFrame(now) {
    if (!this.active) return;
    if (this._lastT > 0) {
      const dt = now - this._lastT;
      if (dt > 0) { const fps = 1000 / dt; this._fpsEma = this._fpsEma ? this._fpsEma * 0.85 + fps * 0.15 : fps; }
    }
    this._lastT = now;

    let result;
    try { result = this.landmarker.detect(this.video, now); }
    catch { return; }

    const has = result.faceLandmarks && result.faceLandmarks.length > 0;
    const pose = has ? this.landmarker.pose(result) : null;
    const lum = sampleLuminance(this.video);

    let faceWidthPx = 0, iodPx = 0;
    if (has) {
      const w = this.video.videoWidth, h = this.video.videoHeight;
      const lm = result.faceLandmarks[0];
      const tr = this.cfg.points.tragion_contour;
      faceWidthPx = Math.hypot((lm[tr.R].x - lm[tr.L].x) * w, (lm[tr.R].y - lm[tr.L].y) * h);
      const irisR = this.cfg.points.iris_centre.R, irisL = this.cfg.points.iris_centre.L;
      iodPx = Math.hypot((lm[irisR].x - lm[irisL].x) * w, (lm[irisR].y - lm[irisL].y) * h);
    }

    const q = frameQuality({
      faceDetected: has,
      faceCount: has ? result.faceLandmarks.length : 0,
      yawDeg: pose ? pose.yaw : 90,
      pitchDeg: pose ? pose.pitch : 90,
      rollDeg: pose ? pose.roll : 90,
      faceWidthPx,
      iodPx,
      luminanceMean: lum.mean,
      lightingSideRatio: lum.sideRatio,
      fps: this._fpsEma || 30,
      occlusion: false,
    }, this.thr);

    this._renderChecklist(q);

    // 1.5 s hold on all hard gates (R3.2).
    if (q.valid) {
      if (this.gatesPassedSince == null) this.gatesPassedSince = now;
      const held = now - this.gatesPassedSince;
      if (held >= this.thr.quality_gates.gate_hold_ms && this.beginBtn) this.beginBtn.disabled = false;
    } else {
      this.gatesPassedSince = null;
      if (this.beginBtn) this.beginBtn.disabled = true;
    }
  }

  _renderChecklist(q) {
    const failing = new Set(q.hardFails);
    const warning = new Set(q.warns);
    document.querySelectorAll('#gate-checklist li').forEach((li) => {
      const codes = GATE_MAP[li.dataset.gate] || [];
      li.classList.remove('is-pass', 'is-warn', 'is-fail');
      if (codes.some((c) => failing.has(c))) li.classList.add('is-fail');
      else if (codes.some((c) => warning.has(c))) li.classList.add('is-warn');
      else li.classList.add('is-pass');
    });
  }
}
