/**
 * SMILE-FA — vision/landmarker.js  (design.md §1)
 *
 * Thin wrapper around the MediaPipe Face Landmarker (via loader.js). Handles
 * GPU delegate with CPU fallback, VIDEO running mode, blendshapes + transform
 * matrix output, and exposes a blendshape name→index map.
 *
 * @module vision/landmarker
 */

import { loadTasksVision, resolveFaceLandmarkerModel } from '../loader.js';

export class Landmarker {
  constructor() {
    this.instance = null;
    /** @type {Record<string, number>} */
    this.bsIndex = {};
  }

  /**
   * Create the FaceLandmarker; tries GPU then falls back to CPU.
   * @returns {Promise<void>}
   */
  async init() {
    const { vision, wasmBase } = await loadTasksVision();
    const { FilesetResolver, FaceLandmarker } = vision;
    const fileset = await FilesetResolver.forVisionTasks(wasmBase);
    const modelAssetPath = await resolveFaceLandmarkerModel();
    const opts = {
      baseOptions: { modelAssetPath, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    };
    try {
      this.instance = await FaceLandmarker.createFromOptions(fileset, opts);
    } catch (err) {
      console.warn('[landmarker] GPU delegate failed, falling back to CPU', err);
      opts.baseOptions.delegate = 'CPU';
      this.instance = await FaceLandmarker.createFromOptions(fileset, opts);
    }
  }

  /**
   * Detect on a video frame.
   * @param {HTMLVideoElement} video
   * @param {number} tMs monotonic timestamp
   * @returns {any} FaceLandmarker result
   */
  detect(video, tMs) {
    const result = this.instance.detectForVideo(video, tMs);
    // Build the blendshape index map once.
    if (result.faceBlendshapes && result.faceBlendshapes[0] && !Object.keys(this.bsIndex).length) {
      result.faceBlendshapes[0].categories.forEach((c, i) => { this.bsIndex[c.categoryName] = i; });
    }
    return result;
  }

  /**
   * Convert a result's blendshape categories to a flat score array aligned to bsIndex.
   * @param {any} result
   * @returns {number[]}
   */
  blendshapeArray(result) {
    const bs = result.faceBlendshapes && result.faceBlendshapes[0];
    if (!bs) return [];
    const arr = new Array(bs.categories.length);
    bs.categories.forEach((c, i) => { arr[i] = c.score; });
    return arr;
  }

  /**
   * Pose (yaw/pitch/roll degrees) from the transformation matrix.
   * @param {any} result
   * @returns {{yaw:number,pitch:number,roll:number}|null}
   */
  pose(result) {
    const mats = result.facialTransformationMatrixes;
    if (!mats || !mats.length) return null;
    const m = mats[0].data;
    const r00 = m[0], r10 = m[1], r20 = m[2], r21 = m[6], r22 = m[10];
    const deg = (r) => (r * 180) / Math.PI;
    return {
      yaw: deg(Math.atan2(r10, r00)),
      pitch: deg(Math.atan2(-r20, Math.hypot(r21, r22))),
      roll: deg(Math.atan2(r21, r22)),
    };
  }
}
