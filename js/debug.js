/**
 * SMILE-FA — debug.js  (T-03 landmark index verification tool, R10.1)
 *
 * Runs the camera + MediaPipe Face Landmarker and draws ALL 478 landmark
 * indices over the (un-mirrored) video so each index in config/landmarks.json
 * can be visually verified. Also shows HF stable-set + midline points, iris
 * rings, per-frame pose/fps/iris diameters, and the raw blendshape list used
 * to plan the T-04 side-convention test.
 *
 * IMPORTANT: this page renders the UN-MIRRORED analysis frame so index labels
 * match true landmark coordinates. Patient LEFT therefore appears on the RIGHT
 * of the debug canvas (see the on-screen L/R guide). The main app preview is
 * mirrored separately (R4.4); mirroring is a display concern only.
 *
 * @module debug
 */

import {
  assertSecureContextForCamera,
  loadTasksVision,
  resolveFaceLandmarkerModel,
  describeVersions,
} from './loader.js';

/** @type {HTMLVideoElement} */
const video = /** @type {HTMLVideoElement} */ (document.getElementById('debug-video'));
/** @type {HTMLCanvasElement} */
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('debug-overlay'));
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const readoutEl = document.getElementById('readout');
const bsListEl = document.getElementById('bs-list');

const opts = {
  showAll: /** @type {HTMLInputElement} */ (document.getElementById('opt-all')),
  showNamed: /** @type {HTMLInputElement} */ (document.getElementById('opt-named')),
  showStable: /** @type {HTMLInputElement} */ (document.getElementById('opt-stable')),
  showIris: /** @type {HTMLInputElement} */ (document.getElementById('opt-iris')),
};

let landmarks = null;   // parsed config/landmarks.json
let faceLandmarker = null;
let lastTs = -1;
let fps = 0;
let fpsEma = 0;

/** Load the patient-side landmark map. */
async function loadLandmarkConfig() {
  const res = await fetch('config/landmarks.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load landmarks.json (${res.status})`);
  return res.json();
}

/** Start the user-facing camera (tech.md capture settings). */
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
}

/** Create the FaceLandmarker in VIDEO mode with blendshapes + transform matrix. */
async function createLandmarker() {
  const { vision, wasmBase } = await loadTasksVision();
  const { FilesetResolver, FaceLandmarker } = vision;
  const filesetResolver = await FilesetResolver.forVisionTasks(wasmBase);
  const modelUrl = await resolveFaceLandmarkerModel();
  return FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: { modelAssetPath: modelUrl, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
}

/** Collect the named single-point indices from landmarks.json for labelling. */
function namedIndexMap() {
  const map = new Map(); // index -> label
  const add = (idx, label) => {
    if (typeof idx !== 'number') return;
    map.set(idx, map.has(idx) ? `${map.get(idx)},${label}` : label);
  };
  for (const [name, pt] of Object.entries(landmarks.points)) {
    if ('R' in pt) add(pt.R, `${name}.R`);
    if ('L' in pt) add(pt.L, `${name}.L`);
    if ('M' in pt) add(pt.M, `${name}.M`);
  }
  for (const [name, idx] of Object.entries(landmarks.midline)) add(idx, `mid.${name}`);
  return map;
}

/** Flatten the stable head-frame fit indices for highlighting. */
function stableIndexSet() {
  const set = new Set();
  for (const pair of landmarks.headframe_fit.bilateral_pairs) { set.add(pair.R); set.add(pair.L); }
  for (const idx of landmarks.headframe_fit.midline_points) set.add(idx);
  return set;
}

/** Iris ring indices (both eyes) for highlighting. */
function irisIndexSet() {
  return new Set([...landmarks.iris_ring.R, ...landmarks.iris_ring.L]);
}

let named, stable, iris;

/** Euclidean distance between two normalised landmarks scaled to canvas px. */
function distPx(a, b, w, h) {
  const dx = (a.x - b.x) * w;
  const dy = (a.y - b.y) * h;
  return Math.hypot(dx, dy);
}

/** Draw one frame of overlay from a FaceLandmarker result. */
function draw(result) {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
    statusEl.textContent = 'No face detected';
    return;
  }
  const pts = result.faceLandmarks[0];

  // All indices (small grey dots)
  if (opts.showAll.checked) {
    ctx.fillStyle = 'rgba(159,180,204,0.55)';
    for (let i = 0; i < pts.length; i++) {
      const x = pts[i].x * w, y = pts[i].y * h;
      ctx.beginPath();
      ctx.arc(x, y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Iris rings (cyan)
  if (opts.showIris.checked) {
    ctx.fillStyle = '#29B6F6';
    for (const i of iris) {
      const x = pts[i].x * w, y = pts[i].y * h;
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Stable head-frame fit set (green squares)
  if (opts.showStable.checked) {
    ctx.fillStyle = '#34D399';
    for (const i of stable) {
      const x = pts[i].x * w, y = pts[i].y * h;
      ctx.fillRect(x - 3, y - 3, 6, 6);
    }
  }

  // Named metric points (amber dots + labels)
  if (opts.showNamed.checked) {
    ctx.font = '11px system-ui, sans-serif';
    for (const [i, label] of named) {
      if (i >= pts.length) continue;
      const x = pts[i].x * w, y = pts[i].y * h;
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#E6F0FA';
      ctx.fillText(`${i} ${label}`, x + 5, y - 5);
    }
  }

  updateReadout(result, pts, w, h);
  statusEl.textContent = 'Tracking';
}

/** Extract pose degrees from the 4x4 transformation matrix (if available). */
function poseFromMatrix(result) {
  const mats = result.facialTransformationMatrixes;
  if (!mats || mats.length === 0) return null;
  const m = mats[0].data; // column-major 4x4
  // Rotation submatrix elements (column-major indexing).
  const r00 = m[0], r10 = m[1], r20 = m[2];
  const r21 = m[6], r22 = m[10], r01 = m[4], r02 = m[8];
  const pitch = Math.atan2(-r20, Math.hypot(r21, r22));
  const yaw = Math.atan2(r10, r00);
  const roll = Math.atan2(r21, r22);
  const deg = (r) => (r * 180) / Math.PI;
  return { yaw: deg(yaw), pitch: deg(pitch), roll: deg(roll) };
}

/** Show per-frame numbers: fps, pose, iris diameters, IOD. */
function updateReadout(result, pts, w, h) {
  const pose = poseFromMatrix(result);
  const irisR = (distPx(pts[469], pts[471], w, h) + distPx(pts[470], pts[472], w, h)) / 2;
  const irisL = (distPx(pts[474], pts[476], w, h) + distPx(pts[475], pts[477], w, h)) / 2;
  const iod = distPx(pts[468], pts[473], w, h);
  const lines = [
    `fps (EMA): ${fpsEma.toFixed(1)}`,
    pose ? `yaw ${pose.yaw.toFixed(1)}°  pitch ${pose.pitch.toFixed(1)}°  roll ${pose.roll.toFixed(1)}°` : 'pose: n/a',
    `iris diam px  R=${irisR.toFixed(1)}  L=${irisL.toFixed(1)}`,
    `IOD px: ${iod.toFixed(1)}   mm/unit≈ ${(11.7 / ((irisR + irisL) / 2)).toFixed(4)}`,
    `landmarks: ${pts.length}`,
    `libs: ${describeVersions()}`,
  ];
  readoutEl.textContent = lines.join('\n');

  // Blendshape list (raw MediaPipe names + scores) — planning input for T-04.
  const bs = result.faceBlendshapes && result.faceBlendshapes[0];
  if (bs) {
    bsListEl.textContent = bs.categories
      .filter((c) => c.score > 0.02)
      .sort((a, b) => b.score - a.score)
      .map((c) => `${c.categoryName.padEnd(20, ' ')} ${c.score.toFixed(3)}`)
      .join('\n') || '(all blendshapes ≈ 0)';
  }
}

/** Match canvas backing size to the video's intrinsic resolution. */
function syncCanvasSize() {
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  if (canvas.width !== vw || canvas.height !== vh) {
    canvas.width = vw;
    canvas.height = vh;
  }
}

/** Main render loop using requestVideoFrameCallback with rAF fallback (design.md §1). */
function loop() {
  const process = (ts) => {
    if (video.readyState >= 2 && faceLandmarker) {
      syncCanvasSize();
      const now = performance.now();
      if (lastTs >= 0) {
        const dt = now - lastTs;
        if (dt > 0) { fps = 1000 / dt; fpsEma = fpsEma ? fpsEma * 0.85 + fps * 0.15 : fps; }
      }
      lastTs = now;
      // Timestamps must be monotonically increasing for VIDEO mode.
      const result = faceLandmarker.detectForVideo(video, now);
      draw(result);
    }
    schedule();
  };
  const schedule = () => {
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      video.requestVideoFrameCallback(() => process(performance.now()));
    } else {
      requestAnimationFrame(() => process(performance.now()));
    }
  };
  schedule();
}

async function main() {
  try {
    assertSecureContextForCamera();
    statusEl.textContent = 'Loading landmark config…';
    landmarks = await loadLandmarkConfig();
    named = namedIndexMap();
    stable = stableIndexSet();
    iris = irisIndexSet();

    statusEl.textContent = 'Loading model…';
    faceLandmarker = await createLandmarker();

    statusEl.textContent = 'Starting camera…';
    await startCamera();

    loop();
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
    console.error(err);
  }
}

main();
