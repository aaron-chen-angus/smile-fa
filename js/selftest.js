/**
 * SMILE-FA — selftest.js  (T-04 side-convention self-test, R10.2 / D2)
 *
 * Verifies the patient-side convention end to end and determines how MediaPipe
 * blendshape "Left"/"Right" suffixes map to the PATIENT's anatomical side.
 *
 * Steps:
 *   1. Wink LEFT eye   → geometry must register patient LEFT; note which
 *                        eyeBlink* suffix dominates.
 *   2. Wink RIGHT eye  → geometry must register patient RIGHT; note suffix.
 *   3. Raise LEFT mouth corner → mouthSmile* / commissure must register LEFT.
 *
 * Geometry ground truth (un-mirrored frame, config/landmarks.json):
 *   patient LEFT  = larger x (image right);  patient RIGHT = smaller x.
 * We use landmark geometry as the source of truth for side, then read which
 * blendshape suffix co-fires to build blendshapes.side_map.
 *
 * The page cannot write files on a static host, so on success it:
 *   - stores the resolved map + verified flag in localStorage, and
 *   - shows the exact JSON to paste into config/landmarks.json.
 *
 * @module selftest
 */

import {
  assertSecureContextForCamera,
  loadTasksVision,
  resolveFaceLandmarkerModel,
} from './loader.js';

const video = /** @type {HTMLVideoElement} */ (document.getElementById('st-video'));
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('st-overlay'));
const ctx = canvas.getContext('2d');
const promptEl = document.getElementById('st-prompt');
const statusEl = document.getElementById('st-status');
const resultsEl = document.getElementById('st-results');
const jsonEl = document.getElementById('st-json');
const startBtn = /** @type {HTMLButtonElement} */ (document.getElementById('st-start'));

let landmarks = null;
let faceLandmarker = null;

/** Named eye indices from config (patient side). */
let idx = null;

/** Blendshape score lookup for a frame result. */
function bsScore(result, name) {
  const bs = result.faceBlendshapes && result.faceBlendshapes[0];
  if (!bs) return 0;
  const cat = bs.categories.find((c) => c.categoryName === name);
  return cat ? cat.score : 0;
}

/** Palpebral fissure height (proxy for openness) for one eye, in normalised units. */
function pfh(pts, upper, lower) {
  return Math.hypot(pts[upper].x - pts[lower].x, pts[upper].y - pts[lower].y);
}

/**
 * Capture the dominant signal over a short sampling window.
 * @param {(r:any)=>void} onFrame called each frame with the latest result
 * @param {number} ms window length
 * @returns {Promise<void>}
 */
function sampleWindow(onFrame, ms) {
  return new Promise((resolve) => {
    const end = performance.now() + ms;
    const step = () => {
      if (video.readyState >= 2 && faceLandmarker) {
        syncCanvasSize();
        const result = faceLandmarker.detectForVideo(video, performance.now());
        drawFace(result);
        if (result.faceLandmarks && result.faceLandmarks.length) onFrame(result);
      }
      if (performance.now() < end) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

function syncCanvasSize() {
  const vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
  if (canvas.width !== vw || canvas.height !== vh) { canvas.width = vw; canvas.height = vh; }
}

/** Light overlay so the user can see tracking; un-mirrored like debug.html. */
function drawFace(result) {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!result.faceLandmarks || !result.faceLandmarks.length) return;
  const pts = result.faceLandmarks[0];
  ctx.fillStyle = 'rgba(41,182,246,0.5)';
  for (const key of ['R', 'L']) {
    for (const i of [idx.upperR, idx.lowerR, idx.upperL, idx.lowerL, idx.commR, idx.commL]) {
      const x = pts[i].x * w, y = pts[i].y * h;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    break;
  }
}

/**
 * Run one eye-wink step. Determines which anatomical eye closed (geometry) and
 * which eyeBlink* suffix dominated (blendshape).
 * @param {'L'|'R'} expectedSide
 * @returns {Promise<{geomSide:'L'|'R'|'unclear', blinkSuffix:'Left'|'Right'|'unclear'}>}
 */
async function runWinkStep(expectedSide) {
  let sumBlinkLeft = 0, sumBlinkRight = 0;
  let minPfhL = Infinity, minPfhR = Infinity, restPfhL = 0, restPfhR = 0, n = 0;

  await sampleWindow((result) => {
    const pts = result.faceLandmarks[0];
    const pL = pfh(pts, idx.upperL, idx.lowerL);
    const pR = pfh(pts, idx.upperR, idx.lowerR);
    minPfhL = Math.min(minPfhL, pL);
    minPfhR = Math.min(minPfhR, pR);
    restPfhL += pL; restPfhR += pR; n += 1;
    sumBlinkLeft += bsScore(result, 'eyeBlinkLeft');
    sumBlinkRight += bsScore(result, 'eyeBlinkRight');
  }, 2500);

  // Geometry: the eye that closed most (largest relative drop in PFH) is the winking eye.
  const dropL = 1 - minPfhL / (restPfhL / n);
  const dropR = 1 - minPfhR / (restPfhR / n);
  let geomSide = 'unclear';
  if (Math.abs(dropL - dropR) > 0.15) geomSide = dropL > dropR ? 'L' : 'R';

  // Blendshape: which suffix dominated.
  let blinkSuffix = 'unclear';
  if (Math.abs(sumBlinkLeft - sumBlinkRight) > 0.3) {
    blinkSuffix = sumBlinkLeft > sumBlinkRight ? 'Left' : 'Right';
  }

  return { geomSide, blinkSuffix, dropL, dropR, sumBlinkLeft, sumBlinkRight, expectedSide };
}

/** Run the mouth-corner step: raise patient LEFT corner. */
async function runMouthStep() {
  let sumSmileLeft = 0, sumSmileRight = 0;
  let yL = 0, yR = 0, n = 0;
  await sampleWindow((result) => {
    const pts = result.faceLandmarks[0];
    yL += pts[idx.commL].y;
    yR += pts[idx.commR].y;
    n += 1;
    sumSmileLeft += bsScore(result, 'mouthSmileLeft');
    sumSmileRight += bsScore(result, 'mouthSmileRight');
  }, 2500);

  // Raised corner = smaller y (higher on image). Compare which side rose more
  // is ambiguous without rest; here we just report which smile suffix dominated
  // and which commissure sits higher.
  const geomSide = (yL / n) < (yR / n) ? 'L' : 'R';
  let smileSuffix = 'unclear';
  if (Math.abs(sumSmileLeft - sumSmileRight) > 0.15) {
    smileSuffix = sumSmileLeft > sumSmileRight ? 'Left' : 'Right';
  }
  return { geomSide, smileSuffix, sumSmileLeft, sumSmileRight, expectedSide: 'L' };
}

function log(msg) { statusEl.textContent = msg; }
function addResult(html) { resultsEl.insertAdjacentHTML('beforeend', `<li>${html}</li>`); }

async function countdown(label, secs) {
  for (let s = secs; s > 0; s--) {
    promptEl.textContent = `${label} (${s})`;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

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

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
}

/** Build side_map from a resolved blendshape suffix for a known patient side. */
function buildSideMap(blinkSuffixForLeft) {
  // If patient LEFT wink lit up eyeBlink<suffix>, then patient L -> suffix.
  const patientL = blinkSuffixForLeft;                         // 'Left' | 'Right'
  const patientR = blinkSuffixForLeft === 'Left' ? 'Right' : 'Left';
  return { patient_L: patientL.toLowerCase(), patient_R: patientR.toLowerCase() };
}

async function runSelfTest() {
  startBtn.disabled = true;
  resultsEl.innerHTML = '';
  jsonEl.textContent = '';

  try {
    // Step 1: wink LEFT
    await countdown('Get ready: wink your LEFT eye', 3);
    promptEl.textContent = 'Wink your LEFT eye and hold…';
    const s1 = await runWinkStep('L');
    addResult(`Wink LEFT → geometry side = <strong>${s1.geomSide}</strong> (dropL ${s1.dropL.toFixed(2)} vs dropR ${s1.dropR.toFixed(2)}); dominant eyeBlink suffix = <strong>${s1.blinkSuffix}</strong>`);

    // Step 2: wink RIGHT
    await countdown('Now wink your RIGHT eye', 3);
    promptEl.textContent = 'Wink your RIGHT eye and hold…';
    const s2 = await runWinkStep('R');
    addResult(`Wink RIGHT → geometry side = <strong>${s2.geomSide}</strong> (dropL ${s2.dropL.toFixed(2)} vs dropR ${s2.dropR.toFixed(2)}); dominant eyeBlink suffix = <strong>${s2.blinkSuffix}</strong>`);

    // Step 3: raise LEFT mouth corner
    await countdown('Raise your LEFT mouth corner', 3);
    promptEl.textContent = 'Raise your LEFT mouth corner and hold…';
    const s3 = await runMouthStep();
    addResult(`Raise LEFT corner → higher commissure side = <strong>${s3.geomSide}</strong>; dominant mouthSmile suffix = <strong>${s3.smileSuffix}</strong>`);

    promptEl.textContent = 'Done';

    // --- Evaluate pass/fail ---------------------------------------------
    const geomOk = s1.geomSide === 'L' && s2.geomSide === 'R' && s3.geomSide === 'L';
    const blinkConsistent =
      s1.blinkSuffix !== 'unclear' &&
      s2.blinkSuffix !== 'unclear' &&
      s1.blinkSuffix !== s2.blinkSuffix; // left/right winks must light opposite suffixes

    if (!geomOk) {
      log('❌ FAIL: geometry side convention did not match. Do NOT trust metrics. Check landmarks.json / mirroring.');
      startBtn.disabled = false;
      return;
    }
    if (!blinkConsistent) {
      log('⚠️ Geometry passed but blendshape winks were inconclusive. Retry with a firmer, isolated wink.');
      startBtn.disabled = false;
      return;
    }

    // patient LEFT wink → s1.blinkSuffix is the suffix for patient L.
    const sideMap = buildSideMap(s1.blinkSuffix);
    // Cross-check with smile suffix (patient L raised → should also be patient_L suffix).
    const smileConsistent =
      s3.smileSuffix === 'unclear' || s3.smileSuffix.toLowerCase() === sideMap.patient_L;

    log(`✅ PASS: patient-side geometry verified. Blendshape suffix map: patient_L → "${sideMap.patient_L}", patient_R → "${sideMap.patient_R}"` +
        (smileConsistent ? '' : ' (note: smile suffix cross-check was inconsistent — re-run to confirm).'));

    // Persist + present JSON to paste into config/landmarks.json.
    const record = {
      verified: true,
      verified_at: new Date().toISOString(),
      blendshapes_side_map: sideMap,
    };
    try { localStorage.setItem('smilefa.selftest', JSON.stringify(record)); } catch { /* ignore */ }

    const patch = {
      'landmarks.json → verified': true,
      'landmarks.json → blendshapes.side_map': sideMap,
    };
    jsonEl.textContent =
      'Paste into config/landmarks.json (set verified:true and fill blendshapes.side_map):\n\n' +
      JSON.stringify(patch, null, 2);
  } catch (err) {
    log(`Error: ${err.message}`);
    console.error(err);
    startBtn.disabled = false;
  }
}

async function main() {
  try {
    assertSecureContextForCamera();
    log('Loading landmark config…');
    landmarks = await fetch('config/landmarks.json', { cache: 'no-store' }).then((r) => r.json());
    idx = {
      upperL: landmarks.points.upper_eyelid_mid.L,
      lowerL: landmarks.points.lower_eyelid_mid.L,
      upperR: landmarks.points.upper_eyelid_mid.R,
      lowerR: landmarks.points.lower_eyelid_mid.R,
      commL: landmarks.points.oral_commissure.L,
      commR: landmarks.points.oral_commissure.R,
    };
    log('Loading model…');
    faceLandmarker = await createLandmarker();
    log('Starting camera…');
    await startCamera();
    log('Ready. Press Start self-test.');
    startBtn.disabled = false;
    startBtn.addEventListener('click', runSelfTest);
  } catch (err) {
    log(`Error: ${err.message}`);
    console.error(err);
  }
}

main();
