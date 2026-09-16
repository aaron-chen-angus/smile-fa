/**
 * SMILE-FA — camera.js  (design.md §1)
 *
 * Camera source (getUserMedia) or video-file source (T-23), plus a frame loop
 * using requestVideoFrameCallback with a requestAnimationFrame fallback.
 *
 * @module camera
 */

import { assertSecureContextForCamera } from './loader.js';

/** Resolution fallback ladder (design.md §5). */
const RESOLUTIONS = [
  { width: 1280, height: 720 },
  { width: 960, height: 540 },
  { width: 640, height: 360 },
];

export class CameraSource {
  /** @param {HTMLVideoElement} video */
  constructor(video) {
    this.video = video;
    this.stream = null;
    this.running = false;
    this._rung = 0;
  }

  /**
   * Start the user-facing camera. Throws a descriptive error if the origin is
   * not secure (R1.3) or permission is denied.
   * @param {number} [rung=0] resolution ladder index
   * @returns {Promise<void>}
   */
  async startCamera(rung = 0) {
    assertSecureContextForCamera();
    this._rung = Math.min(rung, RESOLUTIONS.length - 1);
    const res = RESOLUTIONS[this._rung];
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: res.width }, height: { ideal: res.height } },
      audio: false,
    });
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play();
  }

  /** Step down resolution if fps is too low (design.md §5). @returns {Promise<boolean>} stepped? */
  async stepDownResolution() {
    if (this._rung >= RESOLUTIONS.length - 1) return false;
    this.stop();
    await this.startCamera(this._rung + 1);
    return true;
  }

  /**
   * Use a video FILE as the source (offline validation, T-23 / R10.4).
   * @param {File} file
   * @returns {Promise<void>}
   */
  async startFile(file) {
    const url = URL.createObjectURL(file);
    this.video.srcObject = null;
    this.video.src = url;
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.loop = false;
    await this.video.play();
  }

  /**
   * Run a per-frame callback until stopped. Each call gets its own token so an
   * old loop can be cancelled independently (e.g. handing off setup → test)
   * without stopping the camera stream. Returns a cancel function.
   * @param {(nowMs:number)=>void} onFrame
   * @returns {() => void} cancel this specific loop
   */
  loop(onFrame) {
    this.running = true;
    const token = { alive: true };
    this._loopToken = token;
    const useRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
    const step = () => {
      if (!token.alive || !this.running) return;
      if (this.video.readyState >= 2) onFrame(performance.now());
      if (useRVFC) this.video.requestVideoFrameCallback(step);
      else requestAnimationFrame(step);
    };
    if (useRVFC) this.video.requestVideoFrameCallback(step);
    else requestAnimationFrame(step);
    return () => { token.alive = false; };
  }

  /** Stop the loop and release the camera. */
  stop() {
    this.running = false;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }
}
